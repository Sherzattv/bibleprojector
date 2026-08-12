/**
 * Раскладка рабочей области: ширины боковых панелей и свёрнутый ли план.
 * Персистентна — оператор настраивает пульт один раз, а не каждое служение.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from './storage'
import {
  clampPanelWidth,
  DEFAULT_LIBRARY_WIDTH,
  DEFAULT_SETLIST_WIDTH,
  PANEL_MAX,
  PANEL_MIN,
} from './panel-size'

const KEY = 'bp3-layout'

export type PanelName = 'library' | 'setlist'

export class LayoutStore {
  libraryWidth = $state(DEFAULT_LIBRARY_WIDTH)
  setlistWidth = $state(DEFAULT_SETLIST_WIDTH)
  setlistOpen = $state(true)

  private store: TextStore

  constructor(store: TextStore = createBrowserStore()) {
    this.store = store
    this.load()
  }

  private load() {
    this.libraryWidth = DEFAULT_LIBRARY_WIDTH
    this.setlistWidth = DEFAULT_SETLIST_WIDTH
    this.setlistOpen = true
    try {
      const raw = this.store.get(KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Record<string, unknown>
      // Ширины из хранилища проверяем только по константам: реальной ширины
      // окна на этом этапе ещё нет, а окно к тому же могло стать другим
      if (typeof parsed.libraryWidth === 'number') {
        this.libraryWidth = clampWithinLimits(parsed.libraryWidth)
      }
      if (typeof parsed.setlistWidth === 'number') {
        this.setlistWidth = clampWithinLimits(parsed.setlistWidth)
      }
      if (typeof parsed.setlistOpen === 'boolean') this.setlistOpen = parsed.setlistOpen
    } catch {
      // повреждённое хранилище — остаёмся на дефолтах
    }
  }

  private persist() {
    this.store.set(
      KEY,
      JSON.stringify({
        libraryWidth: this.libraryWidth,
        setlistWidth: this.setlistWidth,
        setlistOpen: this.setlistOpen,
      }),
    )
  }

  widthOf(panel: PanelName): number {
    return panel === 'library' ? this.libraryWidth : this.setlistWidth
  }

  /** Ширина уже посчитана и ограничена вызывающим (там известна ширина окна) */
  setWidth(panel: PanelName, px: number) {
    if (panel === 'library') this.libraryWidth = px
    else this.setlistWidth = px
    this.persist()
  }

  resetWidth(panel: PanelName) {
    this.setWidth(panel, panel === 'library' ? DEFAULT_LIBRARY_WIDTH : DEFAULT_SETLIST_WIDTH)
  }

  toggleSetlist() {
    this.setlistOpen = !this.setlistOpen
    this.persist()
  }

  /** Для тестов: подменить хранилище (без аргумента — чистое in-memory) */
  reset(store: TextStore = createMemoryStore()) {
    this.store = store
    this.load()
  }
}

function clampWithinLimits(px: number): number {
  return clampPanelWidth(px, { total: PANEL_MAX * 4, taken: 0, stageMin: 0, min: PANEL_MIN })
}

export const layout = new LayoutStore()
