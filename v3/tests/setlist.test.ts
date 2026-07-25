import { describe, it, expect, beforeEach } from 'vitest'
import { setlist } from '../src/lib/setlist.svelte'
import { show } from '../src/lib/show.svelte'
import { data } from '../src/lib/db.svelte'
import { rstDb, songs } from './fixtures'

beforeEach(() => {
  data.bibles = { RST: rstDb }
  data.translation = 'RST'
  data.songs = songs
  setlist.currentIdx = -1
  setlist.items = [
    { kind: 'song', num: '310', title: 'Благодать' },
    { kind: 'song', num: '9999', title: 'Тихая песня' }, // номер не существует
    { kind: 'song', num: '8888', title: 'Нет такой' }, // не найдётся вообще
    { kind: 'bible', code: 'JHN', chapter: 3, verse: 2, title: 'Иоанна 3:2' },
    { kind: 'note', title: 'Объявления', text: 'текст' },
  ]
})

describe('setlist.open', () => {
  it('открывает песню по номеру', () => {
    setlist.open(0)
    expect(setlist.currentIdx).toBe(0)
    expect(show.title).toBe('Благодать')
  })

  it('падает на поиск по названию, если номера нет', () => {
    setlist.open(1)
    expect(setlist.currentIdx).toBe(1)
    expect(show.title).toBe('Тихая песня')
  })

  it('ненайденная песня не меняет текущий элемент', () => {
    setlist.open(2)
    expect(setlist.currentIdx).toBe(-1)
  })

  it('открывает главу Библии с нужным стихом в превью', () => {
    setlist.open(3)
    expect(setlist.currentIdx).toBe(3)
    expect(show.kind).toBe('bible')
    expect(show.previewSlide!.reference).toBe('От Иоанна 3:2')
  })

  it('выход за границы — безопасен', () => {
    expect(() => setlist.open(42)).not.toThrow()
  })
})
