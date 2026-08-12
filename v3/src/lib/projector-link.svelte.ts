/**
 * Связь контроллер ↔ экран проектора. Канал абстрагирован
 * (в рантайме BroadcastChannel, в тестах фейк).
 * Статус «подключён» честный: ping/pong с таймаутом.
 */

export interface Channel {
  post(msg: unknown): void
  onmessage: ((msg: unknown) => void) | null
}

/** Команды пульта окну проектора */
export type DisplayCommand = 'fullscreen' | 'close'

interface LinkMsg {
  type: 'ping' | 'pong' | 'hello' | 'state' | 'cmd' | 'fullscreen-failed'
  content?: unknown
  settings?: unknown
  cmd?: DisplayCommand
  /** Экран сообщает вместе с признаком жизни, развёрнут ли он */
  fullscreen?: boolean
}

/** Сторона контроллера */
export class ProjectorLink {
  connected = $state(false)
  /** Развёрнут ли экран на весь монитор — по докладу самого экрана */
  displayFullscreen = $state(false)
  /** Экран поздоровался: окно загрузилось и готово принимать команды */
  onReady: (() => void) | null = null
  /** Экран не смог развернуться даже с переданным правом — тихо промолчать нельзя */
  onFullscreenFailed: (() => void) | null = null

  private channel: Channel
  private pingIntervalMs: number
  private timeoutMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private lastAlive = -Infinity
  private lastState: { content: unknown; settings: unknown } | null = null

  constructor(channel: Channel, opts: { pingIntervalMs?: number; timeoutMs?: number } = {}) {
    this.channel = channel
    this.pingIntervalMs = opts.pingIntervalMs ?? 2000
    this.timeoutMs = opts.timeoutMs ?? 5000
    channel.onmessage = (msg) => this.onMessage(msg as LinkMsg)
  }

  start() {
    if (this.timer) return
    this.timer = setInterval(() => {
      this.channel.post({ type: 'ping' })
      if (Date.now() - this.lastAlive > this.timeoutMs) {
        this.connected = false
        // Об экране, который молчит, мы ничего не знаем — в том числе про fullscreen
        this.displayFullscreen = false
      }
    }, this.pingIntervalMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /**
   * Окно проектора закрыто по нашей же команде — ждать пяти секунд молчания
   * heartbeat незачем, иначе кнопки управления ещё живут и ничего не делают.
   * Если окно всё-таки уцелело, ближайший pong вернёт признак обратно.
   */
  markDisconnected() {
    this.lastAlive = -Infinity
    this.connected = false
    this.displayFullscreen = false
  }

  sendState(content: unknown, settings: unknown) {
    this.lastState = { content, settings }
    this.channel.post({ type: 'state', content, settings })
  }

  /** Развернуть экран / закрыть окно — исполняет сама страница проектора */
  command(cmd: DisplayCommand) {
    this.channel.post({ type: 'cmd', cmd })
  }

  private markAlive(msg: LinkMsg) {
    this.lastAlive = Date.now()
    this.connected = true
    if (typeof msg.fullscreen === 'boolean') this.displayFullscreen = msg.fullscreen
  }

  private onMessage(msg: LinkMsg) {
    if (msg.type === 'pong') {
      this.markAlive(msg)
    } else if (msg.type === 'hello') {
      // Экран открылся (возможно, позже нас) — он жив, и ему нужно текущее состояние
      this.markAlive(msg)
      if (this.lastState) {
        this.channel.post({ type: 'state', ...this.lastState })
      }
      this.onReady?.()
    } else if (msg.type === 'fullscreen-failed') {
      this.onFullscreenFailed?.()
    }
  }
}

/** Сторона экрана */
export class DisplayReceiver {
  content = $state<unknown>({ kind: 'empty' })
  settings = $state<unknown | null>(null)
  /**
   * Развёрнут ли экран. Поле обычное, не рантайм-состояние: его пишет
   * страница проектора, а читаем мы только в ответ на ping.
   */
  fullscreen = false
  /** Пульт прислал команду — исполняет страница проектора */
  onCommand: ((cmd: DisplayCommand) => void) | null = null

  private channel: Channel

  constructor(channel: Channel) {
    this.channel = channel
    channel.onmessage = (msg) => this.onMessage(msg as LinkMsg)
    channel.post({ type: 'hello', fullscreen: this.fullscreen })
  }

  /** Развернуться не вышло — пусть пульт скажет оператору, а не молчит */
  reportFullscreenFailed() {
    this.channel.post({ type: 'fullscreen-failed' })
  }

  private onMessage(msg: LinkMsg) {
    if (msg.type === 'ping') {
      this.channel.post({ type: 'pong', fullscreen: this.fullscreen })
    } else if (msg.type === 'state') {
      this.content = msg.content
      this.settings = msg.settings ?? null
    } else if (msg.type === 'cmd' && msg.cmd) {
      this.onCommand?.(msg.cmd)
    }
  }
}
