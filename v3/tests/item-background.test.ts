import { describe, it, expect, beforeEach } from 'vitest'
import { setlist, SetlistState } from '../src/lib/setlist.svelte'
import { show } from '../src/lib/show.svelte'
import { data } from '../src/lib/db.svelte'
import { commands } from '../src/lib/commands.svelte'
import {
  projSettings,
  ProjSettingsStore,
  normalizeFavorites,
} from '../src/lib/proj-settings.svelte'
import { createMemoryStore } from '../src/lib/storage'
import { rstDb, nrtDb, songs } from './fixtures'

beforeEach(() => {
  data.bibles = { RST: rstDb, NRT: nrtDb }
  data.translation = 'RST'
  data.songs = songs
  show.kind = null
  show.slides = []
  show.liveIdx = -1
  show.blackout = false
  show.itemBackground = null
  projSettings.reset()
  setlist.reset(createMemoryStore())
})

describe('фон пункта порядка служения', () => {
  it('привязанный фон включается первым GO пункта, а не при открытии', () => {
    setlist.add({ kind: 'song', id: 1, title: 'Благодать' })
    setlist.setBackground(0, { preset: 'candles', palette: 'amber' })
    setlist.open(0)
    expect(projSettings.background.preset).toBe('black')
    commands.go()
    expect(projSettings.background).toMatchObject({ preset: 'candles', palette: 'amber' })
  })

  it('включается один раз: ручная смена фона внутри пункта не откатывается', () => {
    setlist.add({ kind: 'song', id: 1, title: 'Благодать' })
    setlist.setBackground(0, { preset: 'candles', palette: 'amber' })
    setlist.open(0)
    commands.go()
    projSettings.selectBackground('fog')
    commands.go()
    expect(projSettings.background.preset).toBe('fog')
  })

  it('пункт без фона не трогает текущий фон', () => {
    projSettings.selectBackground('glass')
    setlist.add({ kind: 'bible', code: 'JHN', chapter: 3, verse: 1, title: 'Ин 3:1' })
    setlist.open(0)
    commands.go()
    expect(projSettings.background.preset).toBe('glass')
  })

  it('открытие не из порядка (поиск, библиотека) сбрасывает ожидающий фон', () => {
    setlist.add({ kind: 'song', id: 1, title: 'Благодать' })
    setlist.setBackground(0, { preset: 'candles', palette: 'amber' })
    setlist.open(0)
    commands.openRef('JHN', 3, 1)
    commands.go()
    expect(projSettings.background.preset).toBe('black')
  })

  it('снять привязку можно, мусорный фон не привязывается', () => {
    setlist.add({ kind: 'song', id: 1, title: 'Благодать' })
    expect(setlist.setBackground(0, { preset: 'дискотека', palette: 'amber' })).toBe(false)
    setlist.setBackground(0, { preset: 'snow', palette: 'midnight' })
    setlist.setBackground(0, null)
    expect(setlist.items[0].background).toBeUndefined()
  })

  it('фон пункта сохраняется, переживает экспорт/импорт, мусор при чтении отбрасывается', () => {
    const store = createMemoryStore()
    const first = new SetlistState(store)
    first.add({ kind: 'song', id: 1, title: 'Благодать' })
    first.setBackground(0, { preset: 'aurora', palette: 'aurora' })
    expect(new SetlistState(store).items[0].background).toEqual({
      preset: 'aurora',
      palette: 'aurora',
    })

    const other = new SetlistState(createMemoryStore())
    expect(other.importJson(first.exportJson())).toBe(true)
    expect(other.items[0].background).toEqual({ preset: 'aurora', palette: 'aurora' })

    expect(
      other.importJson(
        JSON.stringify({ items: [{ kind: 'song', id: 1, title: 'X', background: { preset: 1 } }] }),
      ),
    ).toBe(true)
    expect(other.items[0].background).toBeUndefined()
  })
})

describe('избранные фоны', () => {
  it('звёздочка добавляет и убирает, выбор переживает перезапуск', () => {
    const store = createMemoryStore()
    const s = new ProjSettingsStore(store)
    s.toggleFavorite('candles')
    s.toggleFavorite('fog')
    s.toggleFavorite('candles')
    expect(s.favorites).toEqual(['fog'])
    expect(new ProjSettingsStore(store).favorites).toEqual(['fog'])
  })

  it('не больше 8, без повторов, свой файл и неизвестные id не попадают', () => {
    expect(normalizeFavorites(['fog', 'fog', 'media', 'нет', 42])).toEqual(['fog'])
    const many = ['mesh', 'fog', 'silk', 'stars', 'aurora', 'glass', 'candles', 'rays', 'bokeh']
    expect(normalizeFavorites(many)).toHaveLength(8)
  })

  it('битое избранное в хранилище — пустое, без исключений', () => {
    const store = createMemoryStore({ 'bp3-bg-favorites': '{{{' })
    expect(new ProjSettingsStore(store).favorites).toEqual([])
  })

  it('избранное не едет на экран', () => {
    projSettings.toggleFavorite('fog')
    expect(projSettings.snapshot()).not.toHaveProperty('favorites')
  })
})
