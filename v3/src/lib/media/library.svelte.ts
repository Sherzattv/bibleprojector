/**
 * Свои файлы оператора в IndexedDB пульта: фон (фото/видео) и логотип.
 *
 * refs — лёгкие ссылки (версия и вид) для настроек проекции; сам файл экран
 * запрашивает отдельно (см. media.ts). localStorage для файлов не годится:
 * лимит в несколько мегабайт и строки вместо Blob.
 */
import {
  NO_MEDIA,
  mediaKind,
  validateMedia,
  type MediaPayload,
  type MediaRefs,
  type MediaSlot,
} from './media'

const DB_NAME = 'bp3-media'
const STORE = 'files'

interface StoredFile {
  blob: Blob
  type: string
  name: string
  version: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

class MediaLibrary {
  refs = $state<MediaRefs>({ ...NO_MEDIA })
  /** Имена файлов — подпись в пульте */
  names = $state<Record<MediaSlot, string>>({ background: '', logo: '' })
  /** Object URL для превью в пульте — и картинки, и видео */
  previews = $state<Record<MediaSlot, string | null>>({ background: null, logo: null })

  private available = typeof indexedDB !== 'undefined'

  /** Поднять сохранённое с прошлого запуска */
  async init(): Promise<void> {
    if (!this.available) return
    for (const slot of ['background', 'logo'] as const) {
      try {
        const file = await tx<StoredFile | undefined>('readonly', (s) => s.get(slot))
        if (file) this.adopt(slot, file)
      } catch {
        // IndexedDB недоступна (приватный режим) — свои файлы просто не переживут перезапуск
      }
    }
  }

  private adopt(slot: MediaSlot, file: StoredFile) {
    this.refs = { ...this.refs, [slot]: { version: file.version, kind: mediaKind(file.type) } }
    this.names = { ...this.names, [slot]: file.name }
    const old = this.previews[slot]
    if (old) URL.revokeObjectURL(old)
    this.previews = {
      ...this.previews,
      [slot]: URL.createObjectURL(file.blob),
    }
  }

  /** Сохранить файл; строка — причина отказа для оператора */
  async save(slot: MediaSlot, file: File): Promise<string | null> {
    const error = validateMedia(slot, file)
    if (error) return error
    const stored: StoredFile = {
      blob: file,
      type: file.type,
      name: file.name,
      version: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    }
    if (this.available) {
      try {
        await tx('readwrite', (s) => s.put(stored, slot))
      } catch {
        // Не сохранилось — файл всё равно работает до перезапуска пульта
      }
    }
    this.memory.set(slot, stored)
    this.adopt(slot, stored)
    return null
  }

  async remove(slot: MediaSlot): Promise<void> {
    this.memory.delete(slot)
    if (this.available) {
      try {
        await tx('readwrite', (s) => s.delete(slot))
      } catch {
        // Удалять нечего — и ладно
      }
    }
    const old = this.previews[slot]
    if (old) URL.revokeObjectURL(old)
    this.refs = { ...this.refs, [slot]: null }
    this.names = { ...this.names, [slot]: '' }
    this.previews = { ...this.previews, [slot]: null }
  }

  /** Файлы этого сеанса — на случай, если IndexedDB не записала */
  private memory = new Map<MediaSlot, StoredFile>()

  /** Ответ на запрос экрана */
  async payload(slot: MediaSlot): Promise<MediaPayload | null> {
    const ref = this.refs[slot]
    if (!ref) return { slot, version: '', dataUrl: null }
    let file = this.memory.get(slot)
    if (!file && this.available) {
      file = await tx<StoredFile | undefined>('readonly', (s) => s.get(slot)).catch(() => undefined)
    }
    if (!file || file.version !== ref.version) return null
    return { slot, version: file.version, dataUrl: await readDataUrl(file.blob) }
  }
}

export const mediaLibrary = new MediaLibrary()
