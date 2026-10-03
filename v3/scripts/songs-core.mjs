/**
 * Ядро импорта песен из OpenLP-баз Worship Leader: разбор XML-текста,
 * чистка и пространства id по языкам. Чистый модуль без файлов и SQLite —
 * используется scripts/import-songs.mjs и scripts/convert-data.mjs,
 * покрыт tests/scripts/songs.test.ts.
 */

/**
 * Языки песен и их пространства id. В порядке служения и истории песня
 * хранится по одному числу, поэтому id разных баз не должны пересекаться:
 * казахская песня 5 становится 1 000 005, киргизская — 2 000 005, русские
 * остаются как были (сохранённые порядки служения продолжают работать).
 * Те же числа живут в src/lib/songs/languages.ts — их согласованность
 * проверяет tests/scripts/songs.test.ts.
 */
export const SONG_LANGS = {
  ru: { file: 'songs_ru.js', global: 'SONGS_RU', json: 'songs.json', offset: 0 },
  kk: { file: 'songs_kk.js', global: 'SONGS_KK', json: 'songs_kk.json', offset: 1_000_000 },
  ky: { file: 'songs_ky.js', global: 'SONGS_KY', json: 'songs_ky.json', offset: 2_000_000 },
}

/** Ширина пространства id одного языка */
export const SONG_ID_SPAN = 1_000_000

/** Откуда берутся базы: одна OpenLP-база на язык, пересобирается ежедневно */
export const OPENLP_URL = 'https://worshipleaderapp.com/download/openlp3/{lang}.sqlite'

/** Типы секций OpenLP → метки, которые понимает lib/songs/sections.ts */
const SECTION_LABELS = {
  v: 'Куплет',
  c: 'Припев',
  b: 'Бридж',
  p: 'Предприпев',
  i: 'Вступление',
  e: 'Концовка',
  o: 'Другое',
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[name.toLowerCase()] ?? m
  })
}

/**
 * Текст песни из OpenLP-XML: каждая секция — «[Куплет 1]» и её строки,
 * секции через пустую строку. Пустые секции выбрасываются.
 * @param {string} xml — поле songs.lyrics
 * @returns {string}
 */
export function lyricsToText(xml) {
  const sections = []
  const verseRe = /<verse\b([^>]*)>([\s\S]*?)<\/verse>/g
  for (const [, attrs, body] of xml.matchAll(verseRe)) {
    const type = /\btype="(\w)/.exec(attrs)?.[1]?.toLowerCase() ?? 'v'
    const number = /\blabel="(\d+)"/.exec(attrs)?.[1] ?? '1'
    const cdata = /^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/.exec(body)
    const raw = cdata ? cdata[1] : decodeEntities(body)
    const lines = raw
      .replace(/\r\n?/g, '\n')
      .replace(/\{\/?\w+\}/g, '') // теги форматирования OpenLP: {st}, {/st}
      .split('\n')
      .map((line) => line.trimEnd())
    while (lines.length && !lines[0].trim()) lines.shift()
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop()
    if (!lines.length) continue
    sections.push(`[${SECTION_LABELS[type] ?? 'Куплет'} ${number}]\n${lines.join('\n')}`)
  }
  return sections.join('\n\n')
}

/**
 * Пустышка: нет текста, только аккорды или пометка «минус». Считаем буквы
 * вне меток секций и аккордов — меньше 20 букв песней не бывает.
 * @param {string} text
 */
export function isJunkText(text) {
  const words = text
    .replace(/^\[[^\]]*\]$/gm, ' ')
    .split(/\s+/)
    .filter((w) => !/^[A-H](#|b)?(m|maj|min|sus|dim|aug|add)?\d*(\/[A-H](#|b)?)?$/.test(w))
    .join(' ')
  return (words.match(/\p{L}/gu) ?? []).length < 20
}

/** Строка-заглушка вместо текста: «За текстом обращаться на почту …» */
const CONTACT_LINE = /^.*за текстом обращаться.*$/gim

/** Пометка в названии, что слов нет: «В бою (нет слов)», «(без текста)» */
const NO_WORDS_TITLE = /\(\s*(нет слов|без текста)\s*\)/i

/**
 * Песня-заглушка: в названии сказано, что слов нет, или текста не остаётся
 * без строки «за текстом обращаться на почту».
 * @param {{title: string, text: string}} song
 */
export function isJunkSong({ title, text }) {
  if (NO_WORDS_TITLE.test(title)) return true
  return isJunkText(text.replace(CONTACT_LINE, ' '))
}

/**
 * Чистка готовой базы песен: заглушки уходят, остальное как есть.
 * @template {{title: string, text: string}} T
 * @param {T[]} songs
 * @returns {{songs: T[], dropped: T[]}}
 */
export function sanitizeSongs(songs) {
  const kept = []
  const dropped = []
  for (const song of songs) (isJunkSong(song) ? dropped : kept).push(song)
  return { songs: kept, dropped }
}

/**
 * Строка таблицы songs → песня приложения. Пустышки — null.
 * @param {{id: number, title: string, alternate_title?: string|null,
 *   lyrics: string, song_number?: string|null, copyright?: string|null}} row
 * @returns {{id: number, title: string, text: string, songNumber?: string,
 *   alternateTitle?: string, copyright?: string} | null}
 */
export function songFromRow(row) {
  const title = (row.title ?? '').replace(/\s+/g, ' ').trim()
  const text = lyricsToText(row.lyrics ?? '')
  if (!title || isJunkSong({ title, text })) return null
  const song = { id: Number(row.id), title, text }
  const number = String(row.song_number ?? '').trim()
  if (number) song.songNumber = number
  const alternate = (row.alternate_title ?? '').replace(/\s+/g, ' ').trim()
  if (alternate && alternate !== title) song.alternateTitle = alternate
  const copyright = (row.copyright ?? '').trim()
  if (copyright) song.copyright = copyright
  return song
}

/**
 * Песни базы, отсортированные по названию по правилам языка
 * (казахские Ә, Қ, Ң стоят рядом со своими парами, а не в конце).
 * @param {Array} rows — строки таблицы songs
 * @param {string} lang — 'kk', 'ky', 'ru'
 */
export function songsFromRows(rows, lang) {
  const collator = new Intl.Collator(lang, { sensitivity: 'base', numeric: true, ignorePunctuation: true })
  const songs = rows.map(songFromRow).filter(Boolean)
  songs.sort((a, b) => collator.compare(a.title, b.title) || a.id - b.id)
  return { songs, dropped: rows.length - songs.length }
}

/**
 * Песни языка с id в его пространстве — так они уходят в приложение.
 * @param {Array<{id: number}>} songs
 * @param {keyof typeof SONG_LANGS} lang
 */
export function namespaceSongs(songs, lang) {
  const { offset } = SONG_LANGS[lang]
  return offset ? songs.map((s) => ({ ...s, id: s.id + offset })) : songs
}

/**
 * Проверка базы песен одного языка (id уже в пространстве языка).
 * Пустой массив — всё в порядке.
 * @param {Array<{id: unknown, title: unknown, text: unknown}>} songs
 * @param {keyof typeof SONG_LANGS} lang
 * @returns {string[]}
 */
export function validateSongs(songs, lang) {
  const problems = []
  const { offset } = SONG_LANGS[lang]
  if (!Array.isArray(songs) || !songs.length) return [`песни ${lang}: пустая база`]
  const seen = new Set()
  for (const s of songs) {
    if (!Number.isInteger(s.id) || s.id < offset || s.id >= offset + SONG_ID_SPAN) {
      problems.push(`песни ${lang}: id ${s.id} вне диапазона языка`)
    } else if (seen.has(s.id)) {
      problems.push(`песни ${lang}: повтор id ${s.id}`)
    }
    seen.add(s.id)
    if (typeof s.title !== 'string' || !s.title.trim()) problems.push(`песни ${lang}: id ${s.id} без названия`)
    if (typeof s.text !== 'string') problems.push(`песни ${lang}: id ${s.id} без текста`)
  }
  return problems
}
