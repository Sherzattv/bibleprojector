/**
 * Связь контроллер ↔ экран проектора. Канал абстрагирован
 * (в рантайме BroadcastChannel, в тестах фейк).
 * Статус «подключён» честный: ping/pong с таймаутом.
 */

export interface Channel {
  post(msg: unknown): void
  onmessage: ((msg: unknown) => void) | null
}

interface LinkMsg {
  type: 'ping' | 'pong' | 'hello' | 'state'
  content?: unknown
  settings?: unknown
}

/** Сторона контроллера */
export class ProjectorLink {
  connected = $state(false)

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
      if (Date.now() - this.lastAlive > this.timeoutMs) this.connected = false
    }, this.pingIntervalMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  sendState(content: unknown, settings: unknown) {
    this.lastState = { content, settings }
    this.channel.post({ type: 'state', content, settings })
  }

  private markAlive() {
    this.lastAlive = Date.now()
    this.connected = true
  }

  private onMessage(msg: LinkMsg) {
    if (msg.type === 'pong') {
      this.markAlive()
    } else if (msg.type === 'hello') {
      // Экран открылся (возможно, позже нас) — он жив, и ему нужно текущее состояние
      this.markAlive()
      if (this.lastState) {
        this.channel.post({ type: 'state', ...this.lastState })
      }
    }
  }
}

/** Сторона экрана */
export class DisplayReceiver {
  content = $state<unknown>({ kind: 'empty' })
  settings = $state<unknown | null>(null)

  private channel: Channel

  constructor(channel: Channel) {
    this.channel = channel
    channel.onmessage = (msg) => this.onMessage(msg as LinkMsg)
    channel.post({ type: 'hello' })
  }

  private onMessage(msg: LinkMsg) {
    if (msg.type === 'ping') {
      this.channel.post({ type: 'pong' })
    } else if (msg.type === 'state') {
      this.content = msg.content
      this.settings = msg.settings ?? null
    }
  }
}
