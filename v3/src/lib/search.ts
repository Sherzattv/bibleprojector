/**
 * Умный поиск: ссылки на стихи (legacy-парсер по каноническим кодам),
 * полнотекстовый поиск по Библии и песням на MiniSearch
 * (опечатки, префиксы, ранжирование).
 */
import MiniSearch from 'minisearch'
// @ts-expect-error legacy JS module without types
import { parseQuery, fetchVerse } from './legacy/search.js'
// @ts-expect-error legacy JS module without types
import { TRANSLATION_MAPS, getBookTitle } from './legacy/canonical.js'
import type { BibleDb, SongRow } from './db.svelte'

/** Канонический код по BookId перевода */
export function codeForBookId(translation: string, bookId: number): string | null {
  const map = TRANSLATION_MAPS[translation] as Record<string, number> | undefined
  if (!map) return null
  for (const [code, id] of Object.entries(map)) if (id === bookId) return code
  return null
}

/** Название книги по BookId для подписи результатов */
export function makeTitleGetter(translation: string) {
  const lang = translation === 'KTB' ? 'kz' : translation === 'KYB' ? 'ky' : 'ru'
  return (bookId: number) => {
    const code = codeForBookId(translation, bookId)
    return code ? (getBookTitle(code, lang) as string) : `Книга ${bookId}`
  }
}

export interface ParsedRef {
  canonicalCode: string
  bookName: string
  chapter: string
  verse: string
}

export interface VerseHit {
  id: string
  ref: string
  text: string
  canonicalCode: string
  bookId: number
  chapter: number
  verse: number
}

export { parseQuery, fetchVerse }

const stripTags = (t: string) => t.replace(/<[^>]*>/g, '')
const normalize = (t: string) => t.toLowerCase().replace(/ё/g, 'е')

const miniOptions = {
  processTerm: (term: string) => normalize(term),
  searchOptions: {
    prefix: true,
    fuzzy: 0.2,
    processTerm: (term: string) => normalize(term),
  },
}

// ── Песни ──────────────────────────────────────────────
let songIndex: MiniSearch<SongRow> | null = null

export function buildSongIndex(songs: SongRow[]) {
  songIndex = new MiniSearch<SongRow>({
    fields: ['title', 'alternateTitle', 'songNumber', 'text'],
    storeFields: ['title', 'songNumber'],
    boost: { title: 4, alternateTitle: 3, songNumber: 5, text: 1 },
    ...miniOptions,
  })
  songIndex.addAll(songs)
}

export function searchSongs(query: string, songs: SongRow[], limit = 8): SongRow[] {
  const q = query.trim()
  if (!q || !songIndex) return []
  // Точный номер песни — всегда первым
  const byNumber = /^\d+$/.test(q) ? songs.filter((s) => s.songNumber === q) : []
  const hits = songIndex
    .search(q)
    .slice(0, limit)
    .map((h) => songs.find((s) => s.id === h.id))
    .filter((s): s is SongRow => !!s && !byNumber.includes(s))
  return [...byNumber, ...hits].slice(0, limit)
}

// ── Библия ─────────────────────────────────────────────
const verseIndexes = new Map<string, MiniSearch<VerseHit>>()
const verseDocs = new Map<string, Map<string, VerseHit>>()

export function buildVerseIndex(
  translation: string,
  db: BibleDb,
  getTitle: (bookId: number) => string,
) {
  if (verseIndexes.has(translation)) return
  const index = new MiniSearch<VerseHit>({
    fields: ['text'],
    ...miniOptions,
  })
  const docs = new Map<string, VerseHit>()
  const all: VerseHit[] = []
  for (const book of db.Books) {
    const title = getTitle(book.BookId)
    for (const chapter of book.Chapters) {
      for (const verse of chapter.Verses) {
        const id = `${book.BookId}:${chapter.ChapterId}:${verse.VerseId}`
        // В исходных данных встречаются задвоенные VerseId (напр. Пс 12:6 в РСТ)
        if (docs.has(id)) continue
        const doc: VerseHit = {
          id,
          ref: `${title} ${chapter.ChapterId}:${verse.VerseId}`,
          text: stripTags(verse.Text),
          canonicalCode: '',
          bookId: book.BookId,
          chapter: chapter.ChapterId,
          verse: verse.VerseId,
        }
        docs.set(doc.id, doc)
        all.push(doc)
      }
    }
  }
  index.addAll(all)
  verseIndexes.set(translation, index)
  verseDocs.set(translation, docs)
}

export function hasVerseIndex(translation: string) {
  return verseIndexes.has(translation)
}

export function searchVerses(query: string, translation: string, limit = 8): VerseHit[] {
  const index = verseIndexes.get(translation)
  const docs = verseDocs.get(translation)
  const q = query.trim()
  if (!index || !docs || q.length < 3) return []
  return index
    .search(q)
    .slice(0, limit)
    .map((h) => docs.get(h.id as string))
    .filter((d): d is VerseHit => !!d)
}
