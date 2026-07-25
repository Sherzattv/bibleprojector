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
