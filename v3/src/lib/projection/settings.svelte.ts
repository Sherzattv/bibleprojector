/**
 * Настройки проекции: масштаб шрифта, показ ссылки, тень под текстом и
 * живой фон. Персистентны, устойчивы к мусору в хранилище.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from '../utils/storage'
import {
  DEFAULT_PROJECTION_SETTINGS,
  normalizeProjectionSettings,
  type ChromaKey,
  type FontFamily,
  type OutputLayout,
  type ParallelLayout,
  type ProjectionSettings,
  type TransitionKind,
} from './content'
import { BACKGROUNDS, findPreset } from '../backgrounds/catalog'
import { normalizeBackground, type BackgroundSettings } from '../backgrounds/settings'
import { NO_MEDIA } from '../media/protocol'

const KEY = 'bp3-proj-settings'
/** Избранные фоны — только пульту, на экран не едут, поэтому отдельный ключ */
const FAVORITES_KEY = 'bp3-bg-favorites'
export const FAVORITES_MAX = 8

/** Избранное: известные фоны (кроме своего файла), без повторов, не больше 8 */
export function normalizeFavorites(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const known = new Set(BACKGROUNDS.filter((b) => b.kind !== 'media').map((b) => b.id))
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && known.has(id)))].slice(
    0,
    FAVORITES_MAX,
  )
}
const DEFAULTS = DEFAULT_PROJECTION_SETTINGS

export class ProjSettingsStore {
  fontScale = $state(DEFAULTS.fontScale)
  showReference = $state(DEFAULTS.showReference)
  textShadow = $state(DEFAULTS.textShadow)
  fontFamily = $state<FontFamily>(DEFAULTS.fontFamily)
  transition = $state<TransitionKind>(DEFAULTS.transition)
  transitionMs = $state(DEFAULTS.transitionMs)
  lineHighlight = $state(DEFAULTS.lineHighlight)
  secondaryTranslation = $state<string | null>(DEFAULTS.secondaryTranslation)
  parallelLayout = $state<ParallelLayout>(DEFAULTS.parallelLayout)
  layout = $state<OutputLayout>(DEFAULTS.layout)
  chroma = $state<ChromaKey>(DEFAULTS.chroma)
  background = $state<BackgroundSettings>({ ...DEFAULTS.background })
  favorites = $state<string[]>([])

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
    this.secondaryTranslation = s.secondaryTranslation
    this.parallelLayout = s.parallelLayout
    this.layout = s.layout
    this.chroma = s.chroma
    this.background = s.background
    let favorites: unknown = null
    try {
      const raw = this.store.get(FAVORITES_KEY)
      if (raw) favorites = JSON.parse(raw)
    } catch {
      // повреждённое избранное — начинаем с пустого
    }
    this.favorites = normalizeFavorites(favorites)
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
      secondaryTranslation: this.secondaryTranslation,
      parallelLayout: this.parallelLayout,
      layout: this.layout,
      chroma: this.chroma,
      background: { ...this.background },
      // Свои файлы живут в mediaLibrary — их ссылки подставляет App
      media: { ...NO_MEDIA },
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

  /** Второй перевод и раскладка двух текстов */
  setParallel(patch: { secondaryTranslation?: string | null; parallelLayout?: ParallelLayout }) {
    const s = normalizeProjectionSettings({ ...this.snapshot(), ...patch })
    this.secondaryTranslation = s.secondaryTranslation
    this.parallelLayout = s.parallelLayout
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

  /** Звёздочка: добавить фон в избранное или убрать; сверх лимита не добавляется */
  toggleFavorite(id: string) {
    const next = this.favorites.includes(id)
      ? this.favorites.filter((f) => f !== id)
      : [...this.favorites, id]
    this.favorites = normalizeFavorites(next)
    this.store.set(FAVORITES_KEY, JSON.stringify(this.favorites))
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
