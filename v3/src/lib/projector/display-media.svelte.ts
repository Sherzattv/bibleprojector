/**
 * Свои файлы оператора на стороне экрана. В настройках проекции едут только
 * версии файлов; сам файл экран просит у пульта отдельно и получает
 * data-URL'ом — его превращаем в object URL, чтобы видео не держало в DOM
 * строку на десятки мегабайт.
 */
import { MEDIA_SLOTS, type MediaPayload, type MediaRefs, type MediaSlot } from '../media/protocol'

export interface LoadedMedia {
  version: string
  url: string
  kind: 'image' | 'video'
}

/** Не дождались ответа (пульт перезапускали) — спросим снова через столько */
export const MEDIA_RETRY_MS = 4000

export class DisplayMedia {
  loaded = $state<Record<MediaSlot, LoadedMedia | null>>({ background: null, logo: null })

  private requestedAt: Record<MediaSlot, number> = { background: -Infinity, logo: -Infinity }

  constructor(
    private request: (slot: MediaSlot) => void,
    private now: () => number = () => Date.now(),
  ) {}

  /**
   * Сверить загруженное с тем, что сейчас в настройках: лишнее выбросить,
   * недостающее запросить — не чаще раза в MEDIA_RETRY_MS на слот.
   */
  sync(refs: MediaRefs): void {
    for (const slot of MEDIA_SLOTS) {
      const ref = refs[slot]
      if (!ref) {
        if (this.loaded[slot]) this.drop(slot)
        continue
      }
      if (this.loaded[slot]?.version === ref.version) continue
      const now = this.now()
      if (now - this.requestedAt[slot] < MEDIA_RETRY_MS) continue
      this.requestedAt[slot] = now
      this.request(slot)
    }
  }

  /** Ответ пульта; устаревшая версия или повтор уже загруженного игнорируются */
  async accept(payload: MediaPayload, refs: MediaRefs): Promise<void> {
    const ref = refs[payload.slot]
    if (!payload.dataUrl) return this.drop(payload.slot)
    if (!ref || ref.version !== payload.version) return
    if (this.loaded[payload.slot]?.version === payload.version) return
    try {
      const blob = await (await fetch(payload.dataUrl)).blob()
      this.drop(payload.slot)
      this.loaded = {
        ...this.loaded,
        [payload.slot]: { version: payload.version, url: URL.createObjectURL(blob), kind: ref.kind },
      }
    } catch {
      // Битый файл — останется фон палитры, запрос повторится по таймеру
    }
  }

  private drop(slot: MediaSlot): void {
    const old = this.loaded[slot]
    if (old) URL.revokeObjectURL(old.url)
    this.loaded = { ...this.loaded, [slot]: null }
  }
}
