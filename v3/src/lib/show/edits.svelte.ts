/**
 * Правки текста стихов: оператор может поправить текст перед показом,
 * правка сохраняется по ключу перевод/книга/глава/стих.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from './storage'

// Реэкспорт ради существующих импортов `TextStore` из этого модуля
export type { TextStore }

export class EditsStore {
  private store: TextStore

  constructor(store: TextStore = createBrowserStore()) {
    this.store = store
  }

  private key(translation: string, code: string, chapter: number, verse: number) {
    return `bp3-edit:${translation}:${code}:${chapter}:${verse}`
  }

  save(translation: string, code: string, chapter: number, verse: number, text: string) {
    this.store.set(this.key(translation, code, chapter, verse), text)
  }

  get(translation: string, code: string, chapter: number, verse: number): string | null {
    return this.store.get(this.key(translation, code, chapter, verse))
  }

  clear(translation: string, code: string, chapter: number, verse: number) {
    this.store.remove(this.key(translation, code, chapter, verse))
  }

  /** Для тестов: подменить хранилище (без аргумента — чистое in-memory) */
  reset(store: TextStore = createMemoryStore()) {
    this.store = store
  }
}

export const edits = new EditsStore()
