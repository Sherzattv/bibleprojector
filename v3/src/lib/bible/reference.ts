/**
 * Ссылки на стихи, которые вводит оператор: «ин 3 16», «мф 5:3-10»,
 * «1 кор 13 4», «жар 1:1». Чистый модуль — покрыт tests/reference.test.ts.
 */
import { bookTitleIn, getCanonicalCode } from './books'

export interface ParsedReference {
  canonicalCode: string
  /** Книга, как её ввели, без пробелов: «1кор» */
  bookName: string
  chapter: string
  /** Стих, диапазон или перечисление как введено: «16», «3-10», «4,7» */
  verse: string
}

/** Разобрать ввод; null — это не ссылка (например, текст для полнотекстового поиска) */
export function parseQuery(query: string): ParsedReference | null {
  const normalized = query.toLowerCase().replace(/:/g, ' ').replace(/\s+/g, ' ').trim()
  const match = normalized.match(/^(\d?\s?[а-яёa-z]+)\s+(\d+)\s*([\d,-]*)$/)
  if (!match) return null

  const bookName = match[1].replace(/\s/g, '')
  const canonicalCode = getCanonicalCode(bookName)
  if (!canonicalCode) return null

  return { canonicalCode, bookName, chapter: match[2], verse: match[3] || '1' }
}

/** Ссылка, готовая к открытию: глава и стих, с которого начать */
export interface ResolvedReference {
  canonicalCode: string
  chapter: number
  /** Первый стих диапазона или перечисления */
  verse: number
  /** Подпись в выдаче на языке перевода: «От Иоанна 3:16» */
  label: string
}

export function resolveReference(query: string, translation: string): ResolvedReference | null {
  const parsed = parseQuery(query)
  if (!parsed) return null
  const title = bookTitleIn(parsed.canonicalCode, translation)
  return {
    canonicalCode: parsed.canonicalCode,
    chapter: parseInt(parsed.chapter, 10),
    verse: parseInt(parsed.verse.split(/[-,]/)[0], 10) || 1,
    label: `${title} ${parsed.chapter}:${parsed.verse}`,
  }
}
