/**
 * Настройки проекции: масштаб шрифта, показ ссылки, тень под текстом и
 * живой фон. Персистентны, устойчивы к мусору в хранилище.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from './storage'
import {
  DEFAULT_PROJECTION_SETTINGS,
  normalizeProjectionSettings,
  type ProjectionSettings,
} from './projection'
import { findPreset } from './backgrounds/catalog'
import { normalizeBackground, type BackgroundSettings } from './backgrounds/settings'

const KEY = 'bp3-proj-settings'
const DEFAULTS = DEFAULT_PROJECTION_SETTINGS

export class ProjSettingsStore {
  fontScale = $state(DEFAULTS.fontScale)
  showReference = $state(DEFAULTS.showReference)
  textShadow = $state(DEFAULTS.textShadow)
  background = $state<BackgroundSettings>({ ...DEFAULTS.background })

  private store: TextStore

  constructor(store: TextStore = createBrowserStore()) {
    this.store = store
    this.load()
  }

  private load() {
    let parsed: unknown = null
    try {
      const raw = this.store.get(KEY)
      if (raw) parsed = JSON.parse(raw)
    } catch {
      // повреждённое хранилище — остаёмся на дефолтах
    }
    const s = normalizeProjectionSettings(parsed)
    this.fontScale = s.fontScale
    this.showReference = s.showReference
    this.textShadow = s.textShadow
    this.background = s.background
  }

  private persist() {
    this.store.set(KEY, JSON.stringify(this.snapshot()))
  }

  /** То, что уезжает на экран проектора */
  snapshot(): ProjectionSettings {
    return {
      fontScale: this.fontScale,
      showReference: this.showReference,
      textShadow: this.textShadow,
      background: { ...this.background },
    }
  }

  setFontScale(v: number) {
    this.fontScale = Math.min(2, Math.max(0.5, v))
    this.persist()
  }

  setShowReference(v: boolean) {
    this.showReference = v
    this.persist()
  }

  setTextShadow(v: boolean) {
    this.textShadow = v
    this.persist()
  }

  /** Частичное изменение фона; мусор в patch отбрасывается нормализацией */
  setBackground(patch: Partial<BackgroundSettings>) {
    this.background = normalizeBackground({ ...this.background, ...patch })
    this.persist()
  }

  /** Выбрать фон: вместе с ним ставится его родная палитра */
  selectBackground(id: string) {
    this.setBackground({ preset: id, palette: findPreset(id).palette })
  }

  /** Для тестов: подменить хранилище (без аргумента — чистое in-memory) */
  reset(store: TextStore = createMemoryStore()) {
    this.store = store
    this.load()
  }
}

export const projSettings = new ProjSettingsStore()
