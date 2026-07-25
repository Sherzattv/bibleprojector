/**
 * Настройки проекции: масштаб шрифта и показ ссылки.
 * Персистентны, устойчивы к мусору в хранилище.
 */
import type { TextStore } from './edits.svelte'

const KEY = 'bp3-proj-settings'
const DEFAULTS = { fontScale: 1, showReference: true }

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

export class ProjSettingsStore {
  fontScale = $state(DEFAULTS.fontScale)
  showReference = $state(DEFAULTS.showReference)

  private store: TextStore

  constructor(store: TextStore) {
    this.store = store
    this.load()
  }

  private load() {
    this.fontScale = DEFAULTS.fontScale
    this.showReference = DEFAULTS.showReference
    try {
      const raw = this.store.get(KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { fontScale?: unknown; showReference?: unknown }
      if (typeof parsed.fontScale === 'number') {
        this.fontScale = Math.min(2, Math.max(0.5, parsed.fontScale))
      }
      if (typeof parsed.showReference === 'boolean') {
        this.showReference = parsed.showReference
      }
    } catch {
      // повреждённое хранилище — остаёмся на дефолтах
    }
  }

  private persist() {
    this.store.set(
      KEY,
      JSON.stringify({ fontScale: this.fontScale, showReference: this.showReference }),
    )
  }

  setFontScale(v: number) {
    this.fontScale = Math.min(2, Math.max(0.5, v))
    this.persist()
  }

  setShowReference(v: boolean) {
    this.showReference = v
    this.persist()
  }

  /** Для тестов: подменить хранилище (без аргумента — чистое in-memory) */
  reset(store?: TextStore) {
    this.store = store ?? memoryStore()
    this.load()
  }
}

export const projSettings = new ProjSettingsStore(defaultStore())
