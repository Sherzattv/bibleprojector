/**
 * Раскладка рабочей области: ширины боковых панелей и какие из них свёрнуты.
 * Персистентна — оператор настраивает пульт один раз, а не каждое служение.
 */
import {
  asRecord,
  createBrowserStore,
  createMemoryStore,
  readJson,
  writeJson,
  type TextStore,
} from '../utils/storage'
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
  libraryOpen = $state(true)

  private store: TextStore

  constructor(store: TextStore = createBrowserStore()) {
    this.store = store
    this.load()
  }

  private load() {
    this.libraryWidth = DEFAULT_LIBRARY_WIDTH
    this.setlistWidth = DEFAULT_SETLIST_WIDTH
    this.setlistOpen = true
    this.libraryOpen = true
    const saved = asRecord(readJson(this.store, KEY))
    // Ширины из хранилища проверяем только по константам: реальной ширины
    // окна на этом этапе ещё нет, а окно к тому же могло стать другим
    if (typeof saved.libraryWidth === 'number') {
      this.libraryWidth = clampWithinLimits(saved.libraryWidth)
    }
    if (typeof saved.setlistWidth === 'number') {
      this.setlistWidth = clampWithinLimits(saved.setlistWidth)
    }
    if (typeof saved.setlistOpen === 'boolean') this.setlistOpen = saved.setlistOpen
    if (typeof saved.libraryOpen === 'boolean') this.libraryOpen = saved.libraryOpen
  }

  private persist() {
    writeJson(this.store, KEY, {
      libraryWidth: this.libraryWidth,
      setlistWidth: this.setlistWidth,
      setlistOpen: this.setlistOpen,
      libraryOpen: this.libraryOpen,
    })
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

  toggleLibrary() {
    this.libraryOpen = !this.libraryOpen
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
