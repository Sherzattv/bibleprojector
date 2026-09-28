/**
 * Свои файлы оператора: фото/видео для фона и логотип общины.
 * Чистые функции и типы протокола — покрыты tests/media/protocol.test.ts.
 *
 * Файлы живут в IndexedDB пульта. Экран забирает их по каналу связи
 * data-URL'ом: экран, который вывел браузер (Presentation API), живёт в
 * изолированном профиле и чужую IndexedDB не видит, а строка проходит и
 * через BroadcastChannel, и через PresentationConnection.
 */

export type MediaSlot = 'background' | 'logo'
export const MEDIA_SLOTS: readonly MediaSlot[] = ['background', 'logo']

/** Что экран знает о файле из настроек: хватает, чтобы понять «пора перезапросить» */
export interface MediaRef {
  /** Меняется при каждой загрузке — ключ кэша на экране */
  version: string
  kind: 'image' | 'video'
}

export type MediaRefs = Record<MediaSlot, MediaRef | null>

export const NO_MEDIA: MediaRefs = { background: null, logo: null }

const MB = 1024 * 1024
/** Лимиты держат data-URL в разумных пределах для канала связи */
export const MEDIA_LIMITS = { image: 10 * MB, video: 40 * MB, logo: 2 * MB }

export const VIDEO_TYPES = ['video/mp4', 'video/webm']

/** Проверка файла до записи; строка — понятная оператору причина отказа */
export function validateMedia(
  slot: MediaSlot,
  file: { type: string; size: number },
): string | null {
  const isImage = file.type.startsWith('image/')
  const isVideo = VIDEO_TYPES.includes(file.type)
  if (slot === 'logo') {
    if (!isImage) return 'Логотип должен быть картинкой: PNG, SVG, JPG или WebP.'
    if (file.size > MEDIA_LIMITS.logo) return 'Логотип больше 2 МБ — уменьшите картинку.'
    return null
  }
  if (!isImage && !isVideo) return 'Фоном может быть картинка или видео MP4/WebM.'
  if (isImage && file.size > MEDIA_LIMITS.image) return 'Картинка больше 10 МБ — уменьшите её.'
  if (isVideo && file.size > MEDIA_LIMITS.video) {
    return 'Видео больше 40 МБ — сожмите его или возьмите короткий зацикленный ролик.'
  }
  return null
}

export function mediaKind(type: string): MediaRef['kind'] {
  return VIDEO_TYPES.includes(type) ? 'video' : 'image'
}

function normalizeRef(raw: unknown): MediaRef | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.version !== 'string' || !r.version) return null
  if (r.kind !== 'image' && r.kind !== 'video') return null
  return { version: r.version, kind: r.kind }
}

export function normalizeMediaRefs(raw: unknown): MediaRefs {
  if (!raw || typeof raw !== 'object') return { ...NO_MEDIA }
  const r = raw as Record<string, unknown>
  return { background: normalizeRef(r.background), logo: normalizeRef(r.logo) }
}

/** Ответ пульта на запрос экрана; dataUrl null — файла больше нет */
export interface MediaPayload {
  slot: MediaSlot
  version: string
  dataUrl: string | null
}

export function isMediaPayload(v: unknown): v is MediaPayload {
  if (!v || typeof v !== 'object') return false
  const r = v as Record<string, unknown>
  return (
    MEDIA_SLOTS.includes(r.slot as MediaSlot) &&
    typeof r.version === 'string' &&
    (r.dataUrl === null || (typeof r.dataUrl === 'string' && r.dataUrl.startsWith('data:')))
  )
}
