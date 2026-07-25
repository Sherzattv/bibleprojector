import type { BibleDb } from '../db.svelte'

export interface ParsedQuery {
  canonicalCode: string
  bookName: string
  chapter: string
  verse: string
}

export interface LegacyVerseResult {
  text: string
  reference: string
  bookName: string
  chapter: string
  verse: string
  canonicalCode: string
  bookId: number
  translation: string
}

export function parseQuery(query: string): ParsedQuery | null
export function fetchVerse(
  parsed: ParsedQuery,
  db: BibleDb,
  translation?: string,
): LegacyVerseResult | null

export function fetchVerseMulti(
  parsed: ParsedQuery,
  databases: Record<string, BibleDb>,
  translations?: string[],
): Record<string, LegacyVerseResult | null>

export function fullTextSearch(
  query: string,
  db: BibleDb,
  translation?: string,
  limit?: number,
): LegacyVerseResult[]

export function getNextVerse(
  current: LegacyVerseResult,
  db: BibleDb,
  translation?: string,
): LegacyVerseResult | null

export function getPrevVerse(
  current: LegacyVerseResult,
  db: BibleDb,
  translation?: string,
): LegacyVerseResult | null

export { BOOK_INFO, TRANSLATION_MAPS, getBookTitle } from './canonical.js'
