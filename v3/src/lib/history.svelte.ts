/**
 * История показов: что реально уходило в эфир.
 * Свежие записи в начале, соседние дубли схлопываются, ёмкость 50.
 */

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

export class HistoryStore {
  items = $state<HistoryEntry[]>([])

  push(entry: Omit<HistoryEntry, 'at'> & { at?: number }) {
    const head = this.items[0]
    if (head && head.title === entry.title && head.reference === entry.reference) return
    this.items = [
      { ...entry, at: entry.at ?? Date.now() },
      ...this.items,
    ].slice(0, CAPACITY)
  }

  clear() {
    this.items = []
  }
}

export const history = new HistoryStore()
