/**
 * Связь контроллер ↔ экран проектора. Канал абстрагирован
 * (в рантайме BroadcastChannel, в тестах фейк).
 * Статус «подключён» честный: ping/pong с таймаутом.
 */

export interface Channel {
  post(msg: unknown): void
  onmessage: ((msg: unknown) => void) | null
}

import { MEDIA_SLOTS, isMediaPayload, type MediaPayload, type MediaSlot } from './media'

/** Команды пульта окну проектора */
export type DisplayCommand = 'fullscreen' | 'close'

interface LinkMsg {
  type:
    | 'ping'
    | 'pong'
    | 'hello'
    | 'state'
    | 'cmd'
    | 'fullscreen-failed'
    | 'media-request'
    | 'media'
    | 'pulse'
  content?: unknown
  settings?: unknown
  cmd?: DisplayCommand
  /** Экран сообщает вместе с признаком жизни, развёрнут ли он */
  fullscreen?: boolean
  /** Почему не вышло развернуть — имя и текст DOMException как есть */
  reason?: string
  /** Контраст белого текста с живым фоном по замеру экрана; null — фона нет */
  contrast?: number | null
  /** Какой свой файл нужен экрану */
  slot?: MediaSlot
  /** Сам файл — ответ пульта на media-request */
  media?: MediaPayload
  /** Громкость в зале по микрофону пульта, 0..1 */
  level?: number
}

/** Сторона контроллера */
export class ProjectorLink {
  connected = $state(false)
  /** Развёрнут ли экран на весь монитор — по докладу самого экрана */
  displayFullscreen = $state(false)
  /** Контраст текста с живым фоном по замеру экрана; null — фона нет или не мерили */
  displayContrast = $state<number | null>(null)
  /** Экран поздоровался: окно загрузилось и готово принимать команды */
  onReady: (() => void) | null = null
  /** Экран не смог развернуться даже с переданным правом — тихо промолчать нельзя */
  onFullscreenFailed: ((reason?: string) => void) | null = null
  /** Экрану нужен свой файл оператора (фон или логотип) */
  onMediaRequest: ((slot: MediaSlot) => void) | null = null

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
        this.displayContrast = null
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
    this.displayContrast = null
  }

  sendState(content: unknown, settings: unknown) {
    this.lastState = { content, settings }
    this.channel.post({ type: 'state', content, settings })
  }

  /** Свой файл в ответ на запрос экрана. Не кэшируется в lastState: большой */
  sendMedia(media: MediaPayload) {
    this.channel.post({ type: 'media', media })
  }

  /** Уровень громкости для пульса фона — поток, не состояние */
  sendPulse(level: number) {
    this.channel.post({ type: 'pulse', level })
  }

  /** Развернуть экран / закрыть окно — исполняет сама страница проектора */
  command(cmd: DisplayCommand) {
    this.channel.post({ type: 'cmd', cmd })
  }

  private markAlive(msg: LinkMsg) {
    this.lastAlive = Date.now()
    this.connected = true
    if (typeof msg.fullscreen === 'boolean') this.displayFullscreen = msg.fullscreen
    if (msg.contrast === null) this.displayContrast = null
    else if (typeof msg.contrast === 'number' && Number.isFinite(msg.contrast)) {
      this.displayContrast = msg.contrast
    }
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
      this.onFullscreenFailed?.(msg.reason)
    } else if (msg.type === 'media-request' && MEDIA_SLOTS.includes(msg.slot as MediaSlot)) {
      this.onMediaRequest?.(msg.slot as MediaSlot)
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
  /** Последний замер контраста живого фона — тоже едет с pong */
  contrast: number | null = null
  /** Пульт прислал команду — исполняет страница проектора */
  onCommand: ((cmd: DisplayCommand) => void) | null = null
  /** Пришёл свой файл оператора */
  onMedia: ((media: MediaPayload) => void) | null = null
  /** Громкость в зале по микрофону пульта и когда она пришла */
  micLevel = $state(0)
  micAt = 0

  private channel: Channel

  constructor(channel: Channel) {
    this.channel = channel
    channel.onmessage = (msg) => this.onMessage(msg as LinkMsg)
    this.hello()
  }

  /**
   * Поздороваться: пульт в ответ пришлёт текущее состояние. Кроме старта
   * нужно и при подключении нового контроллера (Presentation API): его
   * соединение поднимается позже, и стартовое hello ушло в пустоту.
   */
  hello() {
    this.channel.post({ type: 'hello', fullscreen: this.fullscreen, contrast: this.contrast })
  }

  /** Попросить у пульта свой файл оператора */
  requestMedia(slot: MediaSlot) {
    this.channel.post({ type: 'media-request', slot })
  }

  /**
   * Развернуться не вышло — пусть пульт скажет оператору, а не молчит.
   * Причину везём как есть: без неё «не сработало» не отличить от
   * «браузер не даёт», и чинить нечего.
   */
  reportFullscreenFailed(reason?: string) {
    this.channel.post({ type: 'fullscreen-failed', reason })
  }

  private onMessage(msg: LinkMsg) {
    if (msg.type === 'ping') {
      this.channel.post({
        type: 'pong',
        fullscreen: this.fullscreen,
        contrast: this.contrast,
      })
    } else if (msg.type === 'state') {
      this.content = msg.content
      this.settings = msg.settings ?? null
    } else if (msg.type === 'cmd' && msg.cmd) {
      this.onCommand?.(msg.cmd)
    } else if (msg.type === 'media' && isMediaPayload(msg.media)) {
      this.onMedia?.(msg.media)
    } else if (
      msg.type === 'pulse' &&
      typeof msg.level === 'number' &&
      Number.isFinite(msg.level)
    ) {
      this.micLevel = Math.min(1, Math.max(0, msg.level))
      this.micAt = Date.now()
    }
  }
}
