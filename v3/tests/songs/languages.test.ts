import { describe, it, expect } from 'vitest'
// @ts-expect-error Node ESM helper written in JavaScript without declarations.
import { SONG_ID_SPAN as SCRIPT_SPAN, SONG_LANGS as SCRIPT_LANGS } from '../../scripts/songs-core.mjs'
import {
  SONG_ID_SPAN,
  SONG_LANGS,
  isSongLang,
  songLangInfo,
  songLangOf,
} from '../../src/lib/songs/languages'

describe('языки песен', () => {
  it('id русских песен остаются как были — сохранённые порядки служения не ломаются', () => {
    expect(songLangOf(1)).toBe('ru')
    expect(songLangOf(11573)).toBe('ru')
  })

  it('язык песни видно по id: казахские с 1 000 000, киргизские с 2 000 000', () => {
    expect(songLangOf(1_000_001)).toBe('kk')
    expect(songLangOf(1_999_999)).toBe('kk')
    expect(songLangOf(2_000_001)).toBe('ky')
  })

  it('id вне всех пространств считается русским', () => {
    expect(songLangOf(9_000_000)).toBe('ru')
  })

  it('isSongLang пропускает только известные языки', () => {
    expect(isSongLang('kk')).toBe(true)
    expect(isSongLang('en')).toBe(false)
    expect(isSongLang(null)).toBe(false)
  })

  it('songLangInfo — имя и файл базы', () => {
    expect(songLangInfo('ky')).toMatchObject({ label: 'Кыргызча', file: 'songs_ky.json' })
  })

  it('пространства id и файлы совпадают с конвертером', () => {
    expect(SCRIPT_SPAN).toBe(SONG_ID_SPAN)
    for (const lang of SONG_LANGS) {
      expect(SCRIPT_LANGS[lang.code]).toMatchObject({ offset: lang.offset, json: lang.file })
    }
    expect(Object.keys(SCRIPT_LANGS).sort()).toEqual(SONG_LANGS.map((l) => l.code).sort())
  })
})
