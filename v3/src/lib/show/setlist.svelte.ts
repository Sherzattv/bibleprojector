/** Порядок служения: сохранение, импорт/экспорт и открытие элементов. */
import { commands } from './commands.svelte'
import { ui } from '../ui/notices.svelte'
import { show } from './show.svelte'
import { createBrowserStore, createMemoryStore, type TextStore } from '../utils/storage'
import {
  MAX_ITEMS,
  normalizeEntry,
  normalizeItemBackground,
  parseEntries,
  type ItemBackground,
  type SetlistEntry,
} from './setlist-entries'

export type { ItemBackground, SetlistEntry }

const STORAGE_KEY = 'bp3-setlist-v1'
const LEGACY_STORAGE_KEY = 'bible_setlist'

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

  /** Заменить пункт i и сохранить порядок */
  private replaceItem(i: number, next: SetlistEntry) {
    this.items = this.items.map((it, index) => (index === i ? next : it))
    this.persist()
  }

  open(i: number) {
    const item = this.items[i]
    if (!item) return
    if (item.kind === 'song') {
      if (!commands.openSong(item.id, item.title)) return
      // Песня нашлась по подписи под другим id (база обновилась) —
      // пункт запоминает новый id, чтобы не искать её каждый раз
      const opened = show.source
      if (opened?.kind === 'song' && opened.id !== item.id) {
        this.replaceItem(i, { ...item, id: opened.id })
      }
    } else if (item.kind === 'bible') {
      if (!commands.openRef(item.code, item.chapter, item.verse)) return
    } else {
      commands.openNote(item.title, item.text)
    }
    this.currentIdx = i
    // Свой фон пункта включится первым GO — не раньше: превью не должно
    // менять то, что сейчас видит зал
    show.itemBackground = item.background ? { ...item.background } : null
    ui.clearNotice()
  }

  /** Привязать фон к пункту или снять привязку (null) */
  setBackground(i: number, background: ItemBackground | null): boolean {
    const item = this.items[i]
    if (!item) return false
    const normalized = background ? normalizeItemBackground(background) : undefined
    if (background && !normalized) return false
    const next = { ...item }
    if (normalized) next.background = normalized
    else delete next.background
    this.replaceItem(i, next)
    if (this.currentIdx === i) show.itemBackground = normalized ? { ...normalized } : null
    return true
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
