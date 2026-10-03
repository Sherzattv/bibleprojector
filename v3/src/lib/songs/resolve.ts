/**
 * Поиск песни, сохранённой в порядке служения или истории. Чистый модуль —
 * покрыт tests/songs/resolve.test.ts.
 *
 * Пункт хранит id и подпись песни («Иса - Ұлы Патша · № 12»). id в
 * выгрузках Worship Leader — это номер строки, и после обновления базы он
 * может съехать на соседнюю песню. Поэтому подпись сверяется: не совпала —
 * ищем песню с той же подписью в базе того же языка.
 */
import type { SongRow } from '../data/db.svelte'
import { songLangOf } from './languages'
import { songBaseReference } from './sections'

function matches(song: SongRow, label: string): boolean {
  return songBaseReference(song) === label || song.title === label
}

/**
 * Песня по id с проверкой подписи. Без подписи — просто по id. Подпись не
 * нашлась нигде — остаётся песня по id (название могли поправить в базе).
 */
export function resolveSong(
  byId: ReadonlyMap<number, SongRow>,
  songs: readonly SongRow[],
  id: number,
  label?: string,
): SongRow | null {
  const song = byId.get(id) ?? null
  const wanted = label?.trim()
  if (!wanted || (song && matches(song, wanted))) return song
  const lang = songLangOf(id)
  return songs.find((s) => songLangOf(s.id) === lang && matches(s, wanted)) ?? song
}
