import { describe, it, expect } from 'vitest'
// Ядро конвертера ещё не вынесено — тест красный до рефакторинга (TDD)
// @ts-expect-error модуль без типов, появится при рефакторинге convert-data.mjs
import { parseGlobalJs, sanitizeBible, validateBible } from '../scripts/convert-core.mjs'

// ── Помощники для мини-баз ─────────────────────────────

function makeBook(bookId: number, verses: Array<{ VerseId: number; Text: string }>) {
  return {
    BookId: bookId,
    Chapters: [{ ChapterId: 1, Verses: verses }],
  }
}

/** База из 66 «книг» по одному стиху — минимально валидная */
function make66(): { Translation: string; Books: ReturnType<typeof makeBook>[] } {
  return {
    Translation: 'RST',
    Books: Array.from({ length: 66 }, (_, i) =>
      makeBook(i + 1, [{ VerseId: 1, Text: `Стих книги ${i + 1}` }]),
    ),
  }
}

// ── parseGlobalJs ──────────────────────────────────────

describe('parseGlobalJs — извлечение window.*-данных из исходника', () => {
  it('парсит простой файл со `;` в конце', () => {
    const src = 'window.bible_data = {"Translation":"RST","Books":[]};\n'
    expect(parseGlobalJs(src)).toEqual({ Translation: 'RST', Books: [] })
  })

  it('парсит файл без точки с запятой в конце строки', () => {
    const src = 'window.bible_data = {"Translation":"NRT","Books":[]}\n'
    expect(parseGlobalJs(src)).toEqual({ Translation: 'NRT', Books: [] })
  })

  it('не хватает комментарий со словом window перед данными', () => {
    const src = [
      '// Этот файл вешает данные на window для legacy-кода',
      'window.ktb_data = {"Translation":"KTB","Books":[]};',
    ].join('\n')
    expect(parseGlobalJs(src)).toEqual({ Translation: 'KTB', Books: [] })
  })

  it('игнорирует вторую строку с const MAP (как в реальном ktb_data.js)', () => {
    const src = [
      'window.ktb_data = {"Translation":"KTB","Books":[{"BookId":1,"Chapters":[]}]};',
      'const KTB_BOOK_MAP = {"1":"Жаратылыс"};',
    ].join('\n')
    expect(parseGlobalJs(src)).toEqual({
      Translation: 'KTB',
      Books: [{ BookId: 1, Chapters: [] }],
    })
  })

  it('парсит массив песен', () => {
    const src = 'window.songs_ru = [{"id":1,"title":"Благодать"}];\n'
    expect(parseGlobalJs(src)).toEqual([{ id: 1, title: 'Благодать' }])
  })

  it('бросает понятную ошибку, если window.*-присваивания нет', () => {
    expect(() => parseGlobalJs('// пустой файл без данных\nconst x = 1;\n')).toThrowError(
      /window/i,
    )
  })
})

// ── sanitizeBible ──────────────────────────────────────

describe('sanitizeBible — чистка данных перевода', () => {
  it('удаляет дубль VerseId (остаётся первый) и пишет его в report', () => {
    const db = {
      Translation: 'RST',
      Books: [
        makeBook(19, [
          { VerseId: 5, Text: 'нормальный стих' },
          { VerseId: 6, Text: 'первый вариант' },
          { VerseId: 6, Text: 'второй вариант (дубль)' },
        ]),
      ],
    }
    const { db: clean, report } = sanitizeBible(db)
    const verses = clean.Books[0].Chapters[0].Verses
    expect(verses).toHaveLength(2)
    expect(verses.find((v: { VerseId: number }) => v.VerseId === 6)?.Text).toBe('первый вариант')
    expect(report.duplicates).toEqual([{ bookId: 19, chapter: 1, verse: 6 }])
    expect(report.emptyVerses).toEqual([])
  })

  it('удаляет стихи с пустым и пробельным Text и пишет их в report', () => {
    const db = {
      Translation: 'RST',
      Books: [
        makeBook(1, [
          { VerseId: 1, Text: 'нормальный стих' },
          { VerseId: 2, Text: '' },
          { VerseId: 3, Text: '   ' },
        ]),
      ],
    }
    const { db: clean, report } = sanitizeBible(db)
    const verses = clean.Books[0].Chapters[0].Verses
    expect(verses.map((v: { VerseId: number }) => v.VerseId)).toEqual([1])
    expect(report.emptyVerses).toEqual([
      { bookId: 1, chapter: 1, verse: 2 },
      { bookId: 1, chapter: 1, verse: 3 },
    ])
    expect(report.duplicates).toEqual([])
  })

  it('чистая база проходит без изменений и с пустым report', () => {
    const db = make66()
    const { db: clean, report } = sanitizeBible(db)
    expect(clean.Books).toHaveLength(66)
    expect(report.duplicates).toEqual([])
    expect(report.emptyVerses).toEqual([])
  })
})

// ── validateBible ──────────────────────────────────────

describe('validateBible — проверка структуры перевода', () => {
  it('валидная база из 66 книг — без проблем', () => {
    expect(validateBible(make66())).toEqual([])
  })

  it('ловит 65 книг вместо 66', () => {
    const db = make66()
    db.Books.pop()
    const problems = validateBible(db)
    expect(problems.length).toBeGreaterThan(0)
    expect(problems.join('\n')).toMatch(/6[56]/)
  })

  it('ловит книгу без глав', () => {
    const db = make66()
    db.Books[10].Chapters = []
    expect(validateBible(db).length).toBeGreaterThan(0)
  })

  it('ловит главу без стихов', () => {
    const db = make66()
    db.Books[3].Chapters[0].Verses = []
    expect(validateBible(db).length).toBeGreaterThan(0)
  })
})
