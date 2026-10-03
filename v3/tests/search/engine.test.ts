import { describe, it, expect } from 'vitest'
import { createSongSearch, createVerseSearch } from '../../src/lib/search/engine'
import { getBookId } from '../../src/lib/bible/books'
import { rstDb, songs, songsKk, songsKy } from '../fixtures'

describe('createSongSearch — поиск песен', () => {
  const search = createSongSearch(songs)

  it('находит по точному названию', () => {
    expect(search.search('Благодать')[0].title).toBe('Благодать')
  })

  it('точный номер песни — первым результатом', () => {
    expect(search.search('579')[0].songNumber).toBe('579')
  })

  it('терпит опечатку («благадать»)', () => {
    const hits = search.search('благадать')
    expect(hits.map((s) => s.title)).toContain('Благодать')
  })

  it('находит по строчке из текста', () => {
    const hits = search.search('пенье цветов')
    expect(hits[0].title).toBe('1000 рук')
  })

  it('ищет по префиксу («аллилу»)', () => {
    const hits = search.search('аллилу')
    expect(hits.map((s) => s.title)).toContain('Аллилуйя')
  })

  it('не различает «е» и «ё»', () => {
    const withYo = createSongSearch([{ id: 9, title: 'Ёлочка', text: 'зелёная' }])
    expect(withYo.search('елочка').map((s) => s.id)).toEqual([9])
  })

  it('пустой запрос — пустой результат', () => {
    expect(search.search('   ')).toEqual([])
  })
})

describe('createSongSearch — несколько языков', () => {
  const search = createSongSearch([...songs, ...songsKk, ...songsKy])

  it('песни выбранного языка идут первыми', () => {
    const hits = search.search('шаттык', 8, 'ky')
    expect(hits[0].id).toBe(2_000_001)
  })

  it('песня другого языка, сильная в общем зачёте, идёт после своих', () => {
    // «Иса» — казахская песня; с русским каталогом она всё равно находится
    const hits = search.search('Иса Ұлы Патша', 8, 'ru')
    expect(hits.map((s) => s.id)).toContain(1_000_001)
    expect(hits.findIndex((s) => s.id >= 1_000_000)).toBe(
      hits.filter((s) => s.id < 1_000_000).length,
    )
  })

  it('песен других языков не больше трёх', () => {
    const many = createSongSearch(
      Array.from({ length: 10 }, (_, i) => ({ id: 1_000_100 + i, title: `Мадақ ${i}`, text: 'мадақ' })),
    )
    expect(many.search('мадақ', 8, 'ru')).toHaveLength(3)
  })

  it('номер песни — сначала из выбранного языка', () => {
    const numbered = createSongSearch([
      { id: 7, title: 'Русская', songNumber: '12', text: 'а' },
      ...songsKk,
    ])
    expect(numbered.search('12', 8, 'kk').map((s) => s.id)).toEqual([1_000_001, 7])
  })
})

describe('createVerseSearch — полнотекстовый поиск по Библии', () => {
  const search = createVerseSearch()
  search.build('RST', rstDb)

  it('индекс строится один раз на перевод', () => {
    expect(search.has('RST')).toBe(true)
    expect(search.has('KTB')).toBe(false)
  })

  it('находит «возлюбил» с корректной ссылкой и кодом книги', () => {
    const hits = search.search('возлюбил', 'RST')
    expect(hits[0]).toMatchObject({
      ref: 'От Иоанна 3:2',
      canonicalCode: 'JHN',
      bookId: getBookId('JHN', 'RST'),
      chapter: 3,
      verse: 2,
    })
    expect(hits[0].text).toContain('возлюбил Бог мир')
  })

  it('терпит опечатку («вазлюбил»)', () => {
    expect(search.search('вазлюбил', 'RST').length).toBeGreaterThan(0)
  })

  it('короткий запрос (<3 символов) не ищет', () => {
    expect(search.search('ин', 'RST')).toEqual([])
  })

  it('ищет по видимому тексту, без разметки перевода', () => {
    const tagged = createVerseSearch()
    tagged.build('NRT', {
      Translation: 'NRT',
      Books: [
        {
          BookId: 43,
          Chapters: [{ ChapterId: 1, Verses: [{ VerseId: 1, Text: '<b>В начале</b> было Слово' }] }],
        },
      ],
    })
    const [hit] = tagged.search('начале', 'NRT')
    expect(hit.text).toBe('В начале было Слово')
  })

  it('неизвестный BookId — подпись «Книга N» и пустой код', () => {
    const unknown = createVerseSearch()
    unknown.build('RST', {
      Translation: 'RST',
      Books: [{ BookId: 99, Chapters: [{ ChapterId: 1, Verses: [{ VerseId: 1, Text: 'странный стих' }] }] }],
    })
    expect(unknown.search('странный', 'RST')[0]).toMatchObject({
      ref: 'Книга 99 1:1',
      canonicalCode: '',
    })
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
    expect(() => createVerseSearch().build('RST', dupDb)).not.toThrow()
  })
})
