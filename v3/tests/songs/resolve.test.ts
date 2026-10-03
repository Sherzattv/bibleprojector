import { describe, it, expect } from 'vitest'
import { resolveSong } from '../../src/lib/songs/resolve'
import type { SongRow } from '../../src/lib/data/db.svelte'
import { songs, songsKk } from '../fixtures'

const all: SongRow[] = [...songs, ...songsKk]
const byId = new Map(all.map((s) => [s.id, s]))

describe('resolveSong — песня из порядка служения или истории', () => {
  it('без подписи — строго по id', () => {
    expect(resolveSong(byId, all, 1)?.title).toBe('Благодать')
    expect(resolveSong(byId, all, 999)).toBeNull()
  })

  it('подпись совпала с песней по id — она и открывается', () => {
    expect(resolveSong(byId, all, 1, 'Благодать · № 310')?.id).toBe(1)
    expect(resolveSong(byId, all, 1, 'Благодать')?.id).toBe(1)
  })

  it('id съехал после обновления базы — песня находится по подписи', () => {
    // В сохранённом пункте «Көтерілді шаңырақ» с id, который теперь у другой песни
    expect(resolveSong(byId, all, 1_000_001, 'Көтерілді шаңырақ')?.id).toBe(1_000_002)
  })

  it('песни с таким id больше нет — тоже ищется по подписи', () => {
    expect(resolveSong(byId, all, 1_000_500, 'Иса - Ұлы Патша · № 12')?.id).toBe(1_000_001)
  })

  it('по подписи ищется только в базе того же языка', () => {
    // Русская запись с подписью казахской песни не уводит в казахскую базу
    expect(resolveSong(byId, all, 500, 'Иса - Ұлы Патша')).toBeNull()
  })

  it('подпись нигде не нашлась — остаётся песня по id', () => {
    expect(resolveSong(byId, all, 3, 'Аллилуйя (старое название)')?.id).toBe(3)
  })
})
