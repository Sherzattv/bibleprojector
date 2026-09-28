/**
 * Доступ к книгам и главам в файле перевода по каноническому коду.
 */
import type { BibleDb, BookRow, ChapterRow } from '../db.svelte'
import { getBookId } from './books'

export function findBook(db: BibleDb, code: string, translation: string): BookRow | null {
  const bookId = getBookId(code, translation)
  if (bookId === null) return null
  return db.Books.find((b) => b.BookId === bookId) ?? null
}

export function findChapter(
  db: BibleDb,
  code: string,
  translation: string,
  chapter: number,
): ChapterRow | null {
  return findBook(db, code, translation)?.Chapters.find((c) => c.ChapterId === chapter) ?? null
}
