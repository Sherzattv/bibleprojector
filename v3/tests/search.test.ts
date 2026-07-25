import { describe, it, expect, beforeAll } from 'vitest'
import {
  parseQuery,
  buildSongIndex,
  searchSongs,
  buildVerseIndex,
  searchVerses,
  hasVerseIndex,
  codeForBookId,
  makeTitleGetter,
} from '../src/lib/search'
import { rstDb, songs } from './fixtures'
// @ts-expect-error legacy JS module without types
import { getBookId } from '../src/lib/legacy/canonical.js'

describe('parseQuery — ссылки на стихи', () => {
  it('понимает «ин 3 16»', () => {
    const p = parseQuery('ин 3 16')
    expect(p).toMatchObject({ canonicalCode: 'JHN', chapter: '3', verse: '16' })
  })

  it('понимает двоеточие и диапазон «мф 5:3-10»', () => {
    const p = parseQuery('мф 5:3-10')
    expect(p).toMatchObject({ canonicalCode: 'MAT', chapter: '5', verse: '3-10' })
  })

  it('понимает книги с номером «1 кор 13 4»', () => {
    const p = parseQuery('1 кор 13 4')
    expect(p).toMatchObject({ canonicalCode: '1CO', chapter: '13', verse: '4' })
  })

  it('понимает казахские сокращения «жар 1:1»', () => {
    const p = parseQuery('жар 1:1')
    expect(p).toMatchObject({ canonicalCode: 'GEN' })
  })

  it('возвращает null на мусор', () => {
    expect(parseQuery('просто текст без цифр')).toBeNull()
  })
})

describe('searchSongs — поиск песен', () => {
  beforeAll(() => buildSongIndex(songs))

  it('находит по точному названию', () => {
    expect(searchSongs('Благодать', songs)[0].title).toBe('Благодать')
  })

  it('точный номер песни — первым результатом', () => {
    expect(searchSongs('579', songs)[0].songNumber).toBe('579')
  })

  it('терпит опечатку («благадать»)', () => {
    const hits = searchSongs('благадать', songs)
    expect(hits.map((s) => s.title)).toContain('Благодать')
  })

  it('находит по строчке из текста', () => {
    const hits = searchSongs('пенье цветов', songs)
    expect(hits[0].title).toBe('1000 рук')
  })

  it('ищет по префиксу («аллилу»)', () => {
    const hits = searchSongs('аллилу', songs)
    expect(hits.map((s) => s.title)).toContain('Аллилуйя')
  })

  it('пустой запрос — пустой результат', () => {
    expect(searchSongs('   ', songs)).toEqual([])
  })
})

describe('searchVerses — полнотекстовый поиск по Библии', () => {
  beforeAll(() => {
    buildVerseIndex('RST', rstDb, makeTitleGetter('RST'))
  })

  it('индекс строится один раз', () => {
    expect(hasVerseIndex('RST')).toBe(true)
    expect(hasVerseIndex('KTB')).toBe(false)
  })

  it('находит «возлюбил» с корректной ссылкой', () => {
    const hits = searchVerses('возлюбил', 'RST')
    expect(hits[0].ref).toBe('От Иоанна 3:2')
    expect(hits[0].text).toContain('возлюбил Бог мир')
  })

  it('терпит опечатку («вазлюбил»)', () => {
    const hits = searchVerses('вазлюбил', 'RST')
    expect(hits.length).toBeGreaterThan(0)
  })

  it('короткий запрос (<3 символов) не ищет', () => {
    expect(searchVerses('ин', 'RST')).toEqual([])
  })

  it('переживает задвоенные VerseId в данных', () => {
    const dupDb = {
      Translation: 'RST',
      Books: [
        {
          BookId: 1,
          Chapters: [
            {
              ChapterId: 1,
              Verses: [
                { VerseId: 6, Text: 'первый вариант стиха' },
                { VerseId: 6, Text: 'второй вариант стиха' },
              ],
            },
          ],
        },
      ],
    }
    // не должно бросить MiniSearch: duplicate ID
    expect(() => buildVerseIndex('DUP', dupDb, () => 'Книга')).not.toThrow()
  })
})

describe('codeForBookId', () => {
  it('обратное отображение согласовано с прямым', () => {
    const id = getBookId('JHN', 'RST')
    expect(codeForBookId('RST', id)).toBe('JHN')
  })

  it('null для неизвестного BookId', () => {
    expect(codeForBookId('RST', 99999)).toBeNull()
  })
})
