/** Персистентная история того, что реально уходило в эфир. */
import {
  createBrowserStore,
  createMemoryStore,
  readJson,
  writeJson,
  type TextStore,
} from '../utils/storage'

export type HistorySource =
  | { kind: 'song'; id: number }
  | { kind: 'bible'; code: string; chapter: number; verse: number }
  | { kind: 'note'; title: string; text: string }

export interface HistoryEntry {
  title: string
  reference: string
  source: HistorySource
  at: number
}

const CAPACITY = 50
const STORAGE_KEY = 'bp3-history-v1'

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<HistoryEntry>
  if (
    typeof entry.title !== 'string' ||
    typeof entry.reference !== 'string' ||
    typeof entry.at !== 'number' ||
    !Number.isFinite(entry.at) ||
    !entry.source ||
    typeof entry.source !== 'object'
  ) {
    return false
  }
  const source = entry.source as Partial<HistorySource>
  if (source.kind === 'song') return Number.isInteger(source.id) && Number(source.id) >= 0
  if (source.kind === 'bible') {
    return (
      typeof source.code === 'string' &&
      source.code.length > 0 &&
      Number.isInteger(source.chapter) &&
      Number(source.chapter) > 0 &&
      Number.isInteger(source.verse) &&
      Number(source.verse) > 0
    )
  }
  return (
    source.kind === 'note' &&
    typeof source.title === 'string' &&
    typeof source.text === 'string'
  )
}

export class HistoryStore {
  items = $state<HistoryEntry[]>([])
  private store: TextStore

  constructor(store: TextStore = createBrowserStore()) {
    this.store = store
    this.load()
  }

  private load() {
    const saved = readJson(this.store, STORAGE_KEY)
    if (Array.isArray(saved)) this.items = saved.filter(isHistoryEntry).slice(0, CAPACITY)
  }

  private persist() {
    writeJson(this.store, STORAGE_KEY, this.items)
  }

  push(entry: Omit<HistoryEntry, 'at'> & { at?: number }) {
    const head = this.items[0]
    if (head && head.title === entry.title && head.reference === entry.reference) return
    this.items = [
      { ...entry, at: entry.at ?? Date.now() },
      ...this.items,
    ].slice(0, CAPACITY)
    this.persist()
  }

  clear() {
    this.items = []
    this.persist()
  }

  reset(store: TextStore = createMemoryStore()) {
    this.store = store
    this.items = []
    this.load()
  }
}

export const history = new HistoryStore()
