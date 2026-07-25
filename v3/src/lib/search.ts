/**
 * Умный поиск: ссылки на стихи (legacy-парсер по каноническим кодам),
 * полнотекстовый поиск по Библии и песням на MiniSearch
 * (опечатки, префиксы, ранжирование).
 */
import MiniSearch from 'minisearch'
import { parseQuery, fetchVerse } from './legacy/search.js'
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

/**
 * Что делает Enter в омнибоксе. В эфир по Ctrl/Cmd+Enter уходит ТОЛЬКО
 * точная ссылка — fuzzy-результаты (опечатки!) никогда не идут в эфир сразу.
 */
export function pickEnterAction(input: {
  parsedRef: unknown | null
  verseHits: unknown[]
  songHits: unknown[]
  withModifier: boolean
}): { type: 'ref'; live: boolean } | { type: 'verse' } | { type: 'song' } | null {
  if (input.parsedRef) return { type: 'ref', live: input.withModifier }
  if (input.verseHits.length) return { type: 'verse' }
  if (input.songHits.length) return { type: 'song' }
  return null
}

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

export interface SongSearch {
  search(query: string, limit?: number): SongRow[]
}

/** Изолированный поисковый инстанс по песням (fuzzy/префикс, номер — первым) */
export function createSongSearch(songs: SongRow[]): SongSearch {
  const index = new MiniSearch<SongRow>({
    fields: ['title', 'alternateTitle', 'songNumber', 'text'],
    storeFields: ['title', 'songNumber'],
    ...miniOptions,
    searchOptions: {
      ...miniOptions.searchOptions,
      boost: { title: 4, alternateTitle: 3, songNumber: 5, text: 1 },
    },
  })
  index.addAll(songs)
  const byId = new Map(songs.map((s) => [s.id, s]))

  return {
    search(query, limit = 8) {
      const q = query.trim()
      if (!q) return []
      // Точный номер песни — всегда первым
      const byNumber = /^\d+$/.test(q) ? songs.filter((s) => s.songNumber === q) : []
      const hits = index
        .search(q)
        .slice(0, limit)
        .map((h) => byId.get(h.id as number))
        .filter((s): s is SongRow => !!s && !byNumber.includes(s))
      return [...byNumber, ...hits].slice(0, limit)
    },
  }
}

// Модульный синглтон — для обратной совместимости со старым API
let defaultSongSearch: SongSearch | null = null

export function buildSongIndex(songs: SongRow[]) {
  defaultSongSearch = createSongSearch(songs)
}

export function searchSongs(query: string, _songs: SongRow[], limit = 8): SongRow[] {
  return defaultSongSearch ? defaultSongSearch.search(query, limit) : []
}

// ── Библия ─────────────────────────────────────────────

export interface VerseSearch {
  build(translation: string, db: BibleDb, getTitle: (bookId: number) => string): void
  has(translation: string): boolean
  search(query: string, translation: string, limit?: number): VerseHit[]
}

/** Изолированный набор стих-индексов (по одному на перевод) */
export function createVerseSearch(): VerseSearch {
  const indexes = new Map<string, MiniSearch<VerseHit>>()
  const docsByTranslation = new Map<string, Map<string, VerseHit>>()

  return {
    build(translation, db, getTitle) {
      if (indexes.has(translation)) return
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
      indexes.set(translation, index)
      docsByTranslation.set(translation, docs)
    },

    has(translation) {
      return indexes.has(translation)
    },

    search(query, translation, limit = 8) {
      const index = indexes.get(translation)
      const docs = docsByTranslation.get(translation)
      const q = query.trim()
      if (!index || !docs || q.length < 3) return []
      return index
        .search(q)
        .slice(0, limit)
        .map((h) => docs.get(h.id as string))
        .filter((d): d is VerseHit => !!d)
    },
  }
}

// Модульный синглтон — для обратной совместимости со старым API
const defaultVerseSearch = createVerseSearch()

export function buildVerseIndex(
  translation: string,
  db: BibleDb,
  getTitle: (bookId: number) => string,
) {
  defaultVerseSearch.build(translation, db, getTitle)
}

export function hasVerseIndex(translation: string) {
  return defaultVerseSearch.has(translation)
}

export function searchVerses(query: string, translation: string, limit = 8): VerseHit[] {
  return defaultVerseSearch.search(query, translation, limit)
}
