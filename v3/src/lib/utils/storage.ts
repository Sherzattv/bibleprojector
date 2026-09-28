export interface TextStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export function createMemoryStore(seed: Record<string, string> = {}): TextStore {
  const values = new Map(Object.entries(seed))
  return {
    get: (key) => values.get(key) ?? null,
    set: (key, value) => {
      values.set(key, value)
    },
    remove: (key) => {
      values.delete(key)
    },
  }
}

export function createBrowserStore(): TextStore {
  if (typeof localStorage === 'undefined') return createMemoryStore()
  return {
    get(key) {
      try {
        return localStorage.getItem(key)
      } catch {
        return null
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value)
      } catch {
        // Storage may be unavailable in private/restricted browser contexts.
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key)
      } catch {
        // Storage may be unavailable in private/restricted browser contexts.
      }
    },
  }
}

/**
 * JSON из хранилища. Нет ключа или там мусор (ручная правка, другая
 * версия, обрыв записи) — null: хранилище пульта не должно ронять старт.
 */
export function readJson(store: TextStore, key: string): unknown {
  const raw = store.get(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function writeJson(store: TextStore, key: string, value: unknown): void {
  store.set(key, JSON.stringify(value))
}

/** Объект для разбора полей по одному; всё, что не объект, — пустой объект */
export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
