import { describe, it, expect } from 'vitest'
import { LayoutStore } from '../src/lib/layout.svelte'
import { createMemoryStore } from '../src/lib/storage'
import { DEFAULT_LIBRARY_WIDTH, DEFAULT_SETLIST_WIDTH, PANEL_MAX, PANEL_MIN } from '../src/lib/panel-size'

describe('LayoutStore — раскладка переживает перезапуск', () => {
  it('чистое хранилище даёт исходные ширины и раскрытый план', () => {
    const store = new LayoutStore(createMemoryStore())
    expect(store.libraryWidth).toBe(DEFAULT_LIBRARY_WIDTH)
    expect(store.setlistWidth).toBe(DEFAULT_SETLIST_WIDTH)
    expect(store.setlistOpen).toBe(true)
  })

  it('ширина и свёрнутость сохраняются и читаются обратно', () => {
    const backing = createMemoryStore()
    const first = new LayoutStore(backing)
    first.setWidth('library', 340)
    first.setWidth('setlist', 300)
    first.toggleSetlist()

    const second = new LayoutStore(backing)
    expect(second.libraryWidth).toBe(340)
    expect(second.setlistWidth).toBe(300)
    expect(second.setlistOpen).toBe(false)
  })

  it('мусор в хранилище не ломает пульт', () => {
    const store = new LayoutStore(createMemoryStore({ 'bp3-layout': '{не json' }))
    expect(store.libraryWidth).toBe(DEFAULT_LIBRARY_WIDTH)
    expect(store.setlistOpen).toBe(true)
  })

  it('невменяемые ширины из хранилища подрезаются по границам', () => {
    const store = new LayoutStore(
      createMemoryStore({
        'bp3-layout': JSON.stringify({ libraryWidth: 5000, setlistWidth: -20 }),
      }),
    )
    expect(store.libraryWidth).toBe(PANEL_MAX)
    expect(store.setlistWidth).toBe(PANEL_MIN)
  })

  it('сброс возвращает исходную ширину только одной панели', () => {
    const store = new LayoutStore(createMemoryStore())
    store.setWidth('library', 400)
    store.setWidth('setlist', 400)
    store.resetWidth('library')
    expect(store.libraryWidth).toBe(DEFAULT_LIBRARY_WIDTH)
    expect(store.setlistWidth).toBe(400)
  })

  it('widthOf отдаёт ширину по имени панели', () => {
    const store = new LayoutStore(createMemoryStore())
    store.setWidth('setlist', 310)
    expect(store.widthOf('setlist')).toBe(310)
    expect(store.widthOf('library')).toBe(DEFAULT_LIBRARY_WIDTH)
  })
})
