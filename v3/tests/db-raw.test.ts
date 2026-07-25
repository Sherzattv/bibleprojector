import { describe, it, expect, beforeEach } from 'vitest'
import { data } from '../src/lib/db.svelte'
import { rstDb, songs, songsDuo214 } from './fixtures'

// bibles/songs становятся «сырыми» ($state.raw): большие объекты не должны
// заворачиваться в глубокий $state-прокси — их идентичность сохраняется,
// чтобы отдавать их в воркер и сравнивать по ссылке.

beforeEach(() => {
  // data — синглтон, сбрасываем состояние между тестами
  data.bibles = {}
  data.songs = []
  data.translation = 'RST'
  data.status = 'loading'
  data.translationStatus = {}
})

describe('data.bibles/songs — сырые ($state.raw)', () => {
  it('присвоенный перевод сохраняет идентичность (не прокси)', () => {
    data.bibles = { RST: rstDb }
    expect(data.bibles.RST).toBe(rstDb)
  })

  it('присвоенный массив песен сохраняет идентичность', () => {
    data.songs = songs
    expect(data.songs).toBe(songs)
  })

  it('элементы массива песен — те же объекты', () => {
    data.songs = songs
    expect(data.songs[0]).toBe(songs[0])
  })
})

describe('data.songsById — карта песен по id', () => {
  it('строится по data.songs', () => {
    data.songs = songs
    expect(data.songsById).toBeInstanceOf(Map)
    expect(data.songsById.get(1)?.title).toBe('Благодать')
  })

  it('пересчитывается при замене data.songs', () => {
    data.songs = songs
    expect(data.songsById.get(1)).toBeDefined()

    data.songs = songsDuo214
    expect(data.songsById.get(5)).toBeDefined()
    expect(data.songsById.get(1)).toBeUndefined()
  })

  it('пустой каталог — пустая карта', () => {
    expect(data.songsById.size).toBe(0)
  })
})
