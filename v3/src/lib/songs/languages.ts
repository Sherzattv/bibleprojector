/**
 * Языки песен. Каждый язык — отдельная база (свой JSON) со своим
 * пространством id: в порядке служения и истории песня хранится одним
 * числом, и по нему же видно, из какой она базы. Те же сдвиги задаёт
 * конвертер (scripts/songs-core.mjs). Чистый модуль — покрыт
 * tests/songs/languages.test.ts.
 */

export type SongLang = 'ru' | 'kk' | 'ky'

export interface SongLangInfo {
  code: SongLang
  /** Полное имя: подсказки и подписи */
  label: string
  /** Короткая метка переключателя */
  short: string
  /** Файл в /data/ */
  file: string
  /** Начало пространства id */
  offset: number
}

/** Ширина пространства id одного языка */
export const SONG_ID_SPAN = 1_000_000

export const SONG_LANGS: readonly SongLangInfo[] = [
  { code: 'ru', label: 'Русские', short: 'Рус', file: 'songs.json', offset: 0 },
  { code: 'kk', label: 'Қазақша', short: 'Қаз', file: 'songs_kk.json', offset: 1_000_000 },
  { code: 'ky', label: 'Кыргызча', short: 'Кыр', file: 'songs_ky.json', offset: 2_000_000 },
]

export const DEFAULT_SONG_LANG: SongLang = 'ru'

export function isSongLang(value: unknown): value is SongLang {
  return SONG_LANGS.some((l) => l.code === value)
}

export function songLangInfo(code: SongLang): SongLangInfo {
  return SONG_LANGS.find((l) => l.code === code) ?? SONG_LANGS[0]
}

/** База песни по её id: работает и до загрузки самой базы */
export function songLangOf(id: number): SongLang {
  const lang = SONG_LANGS.find((l) => id >= l.offset && id < l.offset + SONG_ID_SPAN)
  return lang?.code ?? DEFAULT_SONG_LANG
}
