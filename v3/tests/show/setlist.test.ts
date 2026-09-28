import { describe, it, expect, beforeEach } from 'vitest'
import { SetlistState, setlist } from '../src/lib/setlist.svelte'
import { show } from '../src/lib/show.svelte'
import { data } from '../src/lib/db.svelte'
import { ui } from '../src/lib/ui.svelte'
import { createMemoryStore } from '../src/lib/storage'
import { rstDb, songs, songsDuo214 } from './fixtures'

beforeEach(() => {
  data.bibles = { RST: rstDb }
  data.translation = 'RST'
  data.songs = [...songs, ...songsDuo214]
  setlist.reset()
  ui.clearNotice()
  setlist.items = [
    { kind: 'song', id: 1, title: 'Благодать' },
    { kind: 'song', id: 4, title: 'Тихая песня' }, // песня без номера
    { kind: 'song', id: 999, title: 'Нет такой' }, // id не существует
    { kind: 'bible', code: 'JHN', chapter: 3, verse: 2, title: 'Иоанна 3:2' },
    { kind: 'bible', code: 'JHN', chapter: 99, verse: 1, title: 'Иоанна 99' }, // главы нет
    { kind: 'note', title: 'Объявления', text: 'текст' },
  ]
})

describe('setlist.open — песни по id', () => {
  it('открывает песню строго по id', () => {
    setlist.open(0)
    expect(setlist.currentIdx).toBe(0)
    expect(show.title).toBe('Благодать')
  })

  it('находит и песню без номера — id достаточно', () => {
    setlist.open(1)
    expect(setlist.currentIdx).toBe(1)
    expect(show.title).toBe('Тихая песня')
  })

  it('две песни с одинаковым номером 214 — открывается та, чей id в записи', () => {
    setlist.items = [
      { kind: 'song', id: 5, title: 'Как лань желает' },
      { kind: 'song', id: 6, title: 'Как лань желает (новая)' },
    ]
    setlist.open(0)
    expect(show.title).toBe('Как лань желает')
    setlist.open(1)
    expect(show.title).toBe('Как лань желает (новая)')
    expect(setlist.currentIdx).toBe(1)
  })

  it('ненайденный id не меняет текущий элемент и даёт уведомление', () => {
    setlist.open(2)
    expect(setlist.currentIdx).toBe(-1)
    expect(ui.lastNotice).toBeTypeOf('string')
    expect(ui.lastNotice!.length).toBeGreaterThan(0)
  })

  it('удачное открытие не оставляет уведомления', () => {
    setlist.open(0)
    expect(ui.lastNotice).toBeNull()
  })
})

describe('setlist.open — Библия и границы', () => {
  it('открывает главу Библии с нужным стихом в превью', () => {
    setlist.open(3)
    expect(setlist.currentIdx).toBe(3)
    expect(show.kind).toBe('bible')
    expect(show.previewSlide!.reference).toBe('От Иоанна 3:2')
  })

  it('ненайденная глава не меняет текущий элемент и даёт уведомление', () => {
    setlist.open(4)
    expect(setlist.currentIdx).toBe(-1)
    expect(ui.lastNotice).toBeTypeOf('string')
    expect(ui.lastNotice!.length).toBeGreaterThan(0)
  })

  it('выход за границы — безопасен', () => {
    expect(() => setlist.open(42)).not.toThrow()
  })
})

describe('ui-уведомления', () => {
  it('notify записывает сообщение, clearNotice сбрасывает', () => {
    ui.notify('Песня не найдена')
    expect(ui.lastNotice).toBe('Песня не найдена')
    ui.clearNotice()
    expect(ui.lastNotice).toBeNull()
  })
})

describe('setlist — сохранение и редактирование порядка', () => {
  it('сохраняет добавление, перестановку и удаление', () => {
    const store = createMemoryStore()
    const state = new SetlistState(store)
    expect(state.add({ kind: 'song', id: 1, title: 'Благодать' })).toBe(true)
    expect(state.add({ kind: 'note', title: 'Объявления', text: 'Текст' })).toBe(true)
    expect(state.move(1, -1)).toBe(true)
    expect(state.items[0].kind).toBe('note')
    expect(state.remove(1)).toBe(true)

    const restored = new SetlistState(store)
    expect(restored.items).toEqual([{ kind: 'note', title: 'Объявления', text: 'Текст' }])
  })

  it('импортирует и экспортирует текущую схему', () => {
    const state = new SetlistState(createMemoryStore())
    const source = JSON.stringify({
      version: 1,
      items: [
        { kind: 'bible', code: 'JHN', chapter: 3, verse: 16, title: 'Иоанна 3:16' },
      ],
    })
    expect(state.importJson(source)).toBe(true)
    expect(JSON.parse(state.exportJson())).toEqual({
      version: 1,
      items: [
        { kind: 'bible', code: 'JHN', chapter: 3, verse: 16, title: 'Иоанна 3:16' },
      ],
    })
  })

  it('мигрирует порядок из legacy localStorage без потери song.id', () => {
    const legacy = JSON.stringify({
      version: 1,
      items: [
        {
          kind: 'song',
          title: 'Благодать · № 310',
          payload: { type: 'song', id: 1, title: 'Благодать' },
        },
        {
          kind: 'verse',
          title: 'Иоанна 3:16',
          payload: { type: 'verse', canonicalCode: 'JHN', chapter: 3, verse: '16' },
        },
      ],
    })
    const state = new SetlistState(createMemoryStore({ bible_setlist: legacy }))
    expect(state.items).toEqual([
      { kind: 'song', id: 1, title: 'Благодать · № 310' },
      { kind: 'bible', code: 'JHN', chapter: 3, verse: 16, title: 'Иоанна 3:16' },
    ])
  })

  it('отклоняет повреждённый импорт, не меняя список', () => {
    const state = new SetlistState(createMemoryStore())
    state.add({ kind: 'song', id: 1, title: 'Благодать' })
    expect(state.importJson('{broken')).toBe(false)
    expect(state.items).toHaveLength(1)
  })

  it('не принимает пустые и некорректные идентификаторы', () => {
    const state = new SetlistState(createMemoryStore())
    expect(state.importJson(JSON.stringify({
      items: [
        { kind: 'song', id: null, title: 'Нет id' },
        { kind: 'bible', code: 'JHN', chapter: '', verse: 16, title: 'Нет главы' },
      ],
    }))).toBe(true)
    expect(state.items).toEqual([])
  })
})
