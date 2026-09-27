/**
 * Микрофон пульта для пульса музыки. Слушает пульт, а не экран: разрешение
 * спрашивается у оператора, а проектор в зале не показывает никаких окон.
 * Уровень громкости ~15 раз в секунду уходит на экран через ProjectorLink.
 */
import { rmsLevel } from './pulse'

const SEND_EVERY_MS = 66

export class MicListener {
  active = $state(false)
  /** Почему не слушаем — для подсказки в пульте */
  error = $state<string | null>(null)

  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private level = 0

  async start(send: (level: number) => void): Promise<boolean> {
    if (this.active) return true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      ctx.createMediaStreamSource(stream).connect(analyser)
      const buf = new Uint8Array(analyser.fftSize)
      this.stream = stream
      this.ctx = ctx
      this.timer = setInterval(() => {
        analyser.getByteTimeDomainData(buf)
        // Сглаживание: фон дышит, а не дрожит на каждом слоге
        this.level += (rmsLevel(buf) - this.level) * 0.3
        send(this.level)
      }, SEND_EVERY_MS)
      this.active = true
      this.error = null
      return true
    } catch (e) {
      this.error =
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Браузер не дал доступ к микрофону — разрешите его в настройках сайта.'
          : 'Микрофон не найден или занят другой программой.'
      return false
    }
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    void this.ctx?.close()
    this.ctx = null
    this.level = 0
    this.active = false
  }
}

export const mic = new MicListener()
