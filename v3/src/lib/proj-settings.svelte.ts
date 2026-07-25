/**
 * Настройки проекции: масштаб шрифта и показ ссылки.
 * Персистентны, устойчивы к мусору в хранилище.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from './storage'

const KEY = 'bp3-proj-settings'
const DEFAULTS = { fontScale: 1, showReference: true }

export class ProjSettingsStore {
  fontScale = $state(DEFAULTS.fontScale)
  showReference = $state(DEFAULTS.showReference)

  private store: TextStore

  constructor(store: TextStore = createBrowserStore()) {
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
  reset(store: TextStore = createMemoryStore()) {
    this.store = store
    this.load()
  }
}

export const projSettings = new ProjSettingsStore()
