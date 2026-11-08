import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
// @ts-expect-error Node ESM helper written in JavaScript without declarations.
import { parseGlobalJs } from '../../scripts/convert-core.mjs'

/**
 * В исходнике RST тысячи стихов были со склеенными словами
 * («И сталсвет», «вкотором», «говоритГосподь»). Пробелы восстановлены
 * сверкой с эталонным Синодальным текстом; тест не даёт им вернуться.
 */
type Db = { Books: Array<{ BookId: number; Chapters: Array<{ ChapterId: number; Verses: Array<{ VerseId: number; Text: string }> }> }> }

const path = fileURLToPath(new URL('../../data/source/bible_data.js', import.meta.url))
const db = parseGlobalJs(readFileSync(path, 'utf8')) as Db

function verse(book: number, chapter: number, id: number): string {
  const ch = db.Books.find((b) => b.BookId === book)!.Chapters.find((c) => c.ChapterId === chapter)!
  return ch.Verses.find((v) => v.VerseId === id)!.Text
}

function allTexts(): string[] {
  return db.Books.flatMap((b) => b.Chapters.flatMap((c) => c.Verses.map((v) => v.Text)))
}

describe('RST — пробелы между словами', () => {
  it('известные склейки разделены', () => {
    expect(verse(1, 1, 3)).toBe('И сказал Бог: да будет свет. И стал свет.')
    expect(verse(1, 1, 30)).toContain('в котором душа живая')
    expect(verse(1, 3, 6)).toContain('приятно для глаз')
    expect(verse(26, 24, 6)).toContain('в котором есть накипь')
    expect(verse(26, 24, 6)).toContain('выбрасывайте из него')
  })

  it('нет строчной буквы, слитой с заглавной («говоритГосподь»)', () => {
    const glued = allTexts().flatMap((t) => t.match(/[а-яё][А-ЯЁ]/g) ?? [])
    expect(glued).toEqual([])
  })

  it('после запятой, точки с запятой и двоеточия перед словом стоит пробел', () => {
    const glued = allTexts().filter((t) => /[,;:][А-Яа-яЁё]/.test(t))
    expect(glued).toEqual([])
  })
})
