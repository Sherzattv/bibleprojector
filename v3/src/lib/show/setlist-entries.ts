/**
 * Пункты порядка служения: проверка, разбор сохранённого и импортированного
 * JSON и миграция формата v2 (bible_setlist). Чистый модуль — всё, что
 * пришло из хранилища или файла, проходит здесь, прежде чем попасть в пульт.
 * Покрыт tests/show/setlist.test.ts.
 */
import { BACKGROUNDS, PALETTES, type PaletteId } from '../backgrounds/catalog'

/** Фон, привязанный к пункту: включается первым GO этого пункта */
export interface ItemBackground {
  preset: string
  palette: PaletteId
}

export type SetlistEntry = (
  | { kind: 'song'; id: number; title: string }
  | { kind: 'bible'; code: string; chapter: number; verse: number; title: string }
  | { kind: 'note'; title: string; text: string }
) & { background?: ItemBackground }

export function normalizeItemBackground(value: unknown): ItemBackground | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const preset = BACKGROUNDS.find((b) => b.id === raw.preset)
  const palette = PALETTES.find((p) => p.id === raw.palette)
  return preset && palette ? { preset: preset.id, palette: palette.id } : undefined
}

/** Прикрепить фон к уже разобранному пункту, если он валиден */
function withBackground(entry: SetlistEntry | null, raw: unknown): SetlistEntry | null {
  if (!entry || !raw || typeof raw !== 'object') return entry
  const background = normalizeItemBackground((raw as Record<string, unknown>).background)
  return background ? { ...entry, background } : entry
}

/** Больше пунктов в порядке служения не бывает — защита от вставки мусора */
export const MAX_ITEMS = 200

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value)
  return null
}

export function normalizeEntry(value: unknown): SetlistEntry | null {
  return withBackground(normalizeBaseEntry(value), value)
}

function normalizeBaseEntry(value: unknown): SetlistEntry | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const kind = raw.kind
  const title = asString(raw.title)
  if (!title) return null

  const songId = asInteger(raw.id)
  if (kind === 'song' && songId !== null && songId >= 0) {
    return { kind, id: songId, title }
  }
  if (kind === 'bible') {
    const code = asString(raw.code)
    const chapter = asInteger(raw.chapter)
    const verse = asInteger(raw.verse)
    if (code && chapter !== null && chapter > 0 && verse !== null && verse > 0) {
      return { kind, code, chapter, verse, title }
    }
  }
  if (kind === 'note') {
    return { kind, title, text: typeof raw.text === 'string' ? raw.text : '' }
  }
  return null
}

function normalizeLegacyEntry(value: unknown): SetlistEntry | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const payload =
    raw.payload && typeof raw.payload === 'object'
      ? (raw.payload as Record<string, unknown>)
      : null
  if (!payload) return normalizeEntry(value)

  const title = asString(raw.title)
  if (!title) return null
  const songId = asInteger(payload.id)
  if ((raw.kind === 'song' || payload.type === 'song') && songId !== null && songId >= 0) {
    return { kind: 'song', id: songId, title }
  }
  if (raw.kind === 'verse' || payload.type === 'verse') {
    const code = asString(payload.canonicalCode)
    const chapter = asInteger(payload.chapter)
    const verse = asInteger(String(payload.verse).split(/[-,]/)[0])
    if (code && chapter !== null && chapter > 0 && verse !== null && verse > 0) {
      return { kind: 'bible', code, chapter, verse, title }
    }
  }
  if (raw.kind === 'note' || payload.type === 'note') {
    return {
      kind: 'note',
      title,
      text: typeof payload.text === 'string' ? payload.text : '',
    }
  }
  return null
}

export function parseEntries(raw: string, legacy = false): SetlistEntry[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    const list =
      Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { items?: unknown }).items)
          ? (parsed as { items: unknown[] }).items
          : null
    if (!list) return null
    const normalize = legacy ? normalizeLegacyEntry : normalizeEntry
    return list.map(normalize).filter((item): item is SetlistEntry => item !== null).slice(0, MAX_ITEMS)
  } catch {
    return null
  }
}
