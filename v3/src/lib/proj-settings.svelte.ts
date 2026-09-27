/**
 * Настройки проекции: масштаб шрифта, показ ссылки, тень под текстом и
 * живой фон. Персистентны, устойчивы к мусору в хранилище.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from './storage'
import {
  DEFAULT_PROJECTION_SETTINGS,
  normalizeProjectionSettings,
  type ChromaKey,
  type FontFamily,
  type OutputLayout,
  type ProjectionSettings,
  type TransitionKind,
} from './projection'
import { findPreset } from './backgrounds/catalog'
import { normalizeBackground, type BackgroundSettings } from './backgrounds/settings'
import { NO_MEDIA } from './media'
import { normalizePulse, type PulseSettings } from './pulse'

const KEY = 'bp3-proj-settings'
const DEFAULTS = DEFAULT_PROJECTION_SETTINGS

export class ProjSettingsStore {
  fontScale = $state(DEFAULTS.fontScale)
  showReference = $state(DEFAULTS.showReference)
  textShadow = $state(DEFAULTS.textShadow)
  fontFamily = $state<FontFamily>(DEFAULTS.fontFamily)
  transition = $state<TransitionKind>(DEFAULTS.transition)
  transitionMs = $state(DEFAULTS.transitionMs)
  lineHighlight = $state(DEFAULTS.lineHighlight)
  layout = $state<OutputLayout>(DEFAULTS.layout)
  chroma = $state<ChromaKey>(DEFAULTS.chroma)
  background = $state<BackgroundSettings>({ ...DEFAULTS.background })
  pulse = $state<PulseSettings>({ ...DEFAULTS.pulse })

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
    this.fontFamily = s.fontFamily
    this.transition = s.transition
    this.transitionMs = s.transitionMs
    this.lineHighlight = s.lineHighlight
    this.layout = s.layout
    this.chroma = s.chroma
    this.background = s.background
    this.pulse = s.pulse
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
      fontFamily: this.fontFamily,
      transition: this.transition,
      transitionMs: this.transitionMs,
      lineHighlight: this.lineHighlight,
      layout: this.layout,
      chroma: this.chroma,
      background: { ...this.background },
      // Свои файлы живут в mediaLibrary — их ссылки подставляет App
      media: { ...NO_MEDIA },
      pulse: { ...this.pulse },
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

  /** Шрифт, переход и подсветка строки — через ту же нормализацию, что и хранилище */
  setText(patch: {
    fontFamily?: FontFamily
    transition?: TransitionKind
    transitionMs?: number
    lineHighlight?: boolean
  }) {
    const s = normalizeProjectionSettings({ ...this.snapshot(), ...patch })
    this.fontFamily = s.fontFamily
    this.transition = s.transition
    this.transitionMs = s.transitionMs
    this.lineHighlight = s.lineHighlight
    this.persist()
  }

  /** Вывод: весь экран или нижняя треть для трансляции */
  setOutput(patch: { layout?: OutputLayout; chroma?: ChromaKey }) {
    const s = normalizeProjectionSettings({ ...this.snapshot(), ...patch })
    this.layout = s.layout
    this.chroma = s.chroma
    this.persist()
  }

  /** Частичное изменение фона; мусор в patch отбрасывается нормализацией */
  setBackground(patch: Partial<BackgroundSettings>) {
    this.background = normalizeBackground({ ...this.background, ...patch })
    this.persist()
  }

  setPulse(patch: Partial<PulseSettings>) {
    this.pulse = normalizePulse({ ...this.pulse, ...patch })
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
