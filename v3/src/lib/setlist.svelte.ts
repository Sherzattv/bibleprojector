/** Порядок служения: сохранение, импорт/экспорт и открытие элементов. */
import { commands } from './commands.svelte'
import { ui } from './ui.svelte'
import { show } from './show.svelte'
import { createBrowserStore, createMemoryStore, type TextStore } from './storage'

export type SetlistEntry =
  | { kind: 'song'; id: number; title: string }
  | { kind: 'bible'; code: string; chapter: number; verse: number; title: string }
  | { kind: 'note'; title: string; text: string }

const STORAGE_KEY = 'bp3-setlist-v1'
const LEGACY_STORAGE_KEY = 'bible_setlist'
const MAX_ITEMS = 200

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value)
  return null
}

function normalizeEntry(value: unknown): SetlistEntry | null {
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

function parseEntries(raw: string, legacy = false): SetlistEntry[] | null {
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

export class SetlistState {
  items = $state<SetlistEntry[]>([])
  currentIdx = $state(-1)
  private store: TextStore

  constructor(store: TextStore = createBrowserStore()) {
    this.store = store
    this.load()
  }

  private load() {
    const current = this.store.get(STORAGE_KEY)
    const restored = current ? parseEntries(current) : null
    if (restored) {
      this.items = restored
      return
    }

    const legacy = this.store.get(LEGACY_STORAGE_KEY)
    const migrated = legacy ? parseEntries(legacy, true) : null
    if (migrated?.length) {
      this.items = migrated
      this.persist()
    }
  }

  private persist() {
    this.store.set(STORAGE_KEY, this.exportJson(false))
  }

  open(i: number) {
    const item = this.items[i]
    if (!item) return
    if (item.kind === 'song') {
      if (!commands.openSong(item.id)) return
    } else if (item.kind === 'bible') {
      if (!commands.openRef(item.code, item.chapter, item.verse)) return
    } else {
      commands.openNote(item.title, item.text)
    }
    this.currentIdx = i
    ui.clearNotice()
  }

  add(entry: SetlistEntry): boolean {
    const normalized = normalizeEntry(entry)
    if (!normalized || this.items.length >= MAX_ITEMS) return false
    this.items = [...this.items, normalized]
    this.persist()
    return true
  }

  addCurrent(): boolean {
    const source = show.source
    if (!source) {
      ui.notify('Сначала выберите стих, песню или заметку')
      return false
    }
    let entry: SetlistEntry
    if (source.kind === 'song') {
      entry = { kind: 'song', id: source.id, title: show.baseReference || show.title }
    } else if (source.kind === 'bible') {
      const verse = show.previewSlide?.verse ?? 1
      entry = {
        kind: 'bible',
        code: source.code,
        chapter: source.chapter,
        verse,
        title: show.previewSlide?.reference || show.title,
      }
    } else {
      entry = { kind: 'note', title: source.title, text: source.text }
    }
    const added = this.add(entry)
    if (added) ui.notify(`Добавлено в порядок: ${entry.title}`)
    return added
  }

  remove(i: number): boolean {
    if (i < 0 || i >= this.items.length) return false
    this.items = this.items.filter((_, index) => index !== i)
    if (this.currentIdx === i) this.currentIdx = -1
    else if (this.currentIdx > i) this.currentIdx--
    this.persist()
    return true
  }

  move(i: number, offset: -1 | 1): boolean {
    const target = i + offset
    if (i < 0 || i >= this.items.length || target < 0 || target >= this.items.length) return false
    const next = [...this.items]
    ;[next[i], next[target]] = [next[target], next[i]]
    this.items = next
    if (this.currentIdx === i) this.currentIdx = target
    else if (this.currentIdx === target) this.currentIdx = i
    this.persist()
    return true
  }

  clear() {
    this.items = []
    this.currentIdx = -1
    this.persist()
  }

  exportJson(pretty = true): string {
    return JSON.stringify({ version: 1, items: this.items }, null, pretty ? 2 : 0)
  }

  importJson(raw: string): boolean {
    const entries = parseEntries(raw, true)
    if (!entries) return false
    this.items = entries
    this.currentIdx = -1
    this.persist()
    return true
  }

  reset(store: TextStore = createMemoryStore()) {
    this.store = store
    this.items = []
    this.currentIdx = -1
    this.load()
  }
}

export const setlist = new SetlistState()
