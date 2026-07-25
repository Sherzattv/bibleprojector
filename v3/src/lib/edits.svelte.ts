/**
 * Правки текста стихов: оператор может поправить текст перед показом,
 * правка сохраняется по ключу перевод/книга/глава/стих.
 */

export interface TextStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

function memoryStore(): TextStore {
  const mem = new Map<string, string>()
  return {
    get: (k) => mem.get(k) ?? null,
    set: (k, v) => {
      mem.set(k, v)
    },
    remove: (k) => {
      mem.delete(k)
    },
  }
}

function defaultStore(): TextStore {
  if (typeof localStorage === 'undefined') return memoryStore()
  return {
    get: (k) => localStorage.getItem(k),
    set: (k, v) => localStorage.setItem(k, v),
    remove: (k) => localStorage.removeItem(k),
  }
}

export class EditsStore {
  private store: TextStore

  constructor(store: TextStore) {
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
  reset(store?: TextStore) {
    this.store = store ?? memoryStore()
  }
}

export const edits = new EditsStore(defaultStore())
