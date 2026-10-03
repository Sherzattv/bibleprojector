/**
 * Полнотекстовый поиск по Библии и песням на MiniSearch: опечатки, префиксы,
 * ранжирование. Точные ссылки разбирает bible/reference — до fuzzy-поиска.
 * Индексы живут в Web Worker (backend.ts).
 */
import MiniSearch from 'minisearch'
import { bookTitleIn, codeForBookId } from '../bible/books'
import { foldText, stripMarkup } from '../utils/text'
import { songLangOf, type SongLang } from '../songs/languages'
import type { BibleDb, SongRow } from '../data/db.svelte'

export interface VerseHit {
  id: string
  ref: string
  text: string
  /** Канонический код книги; пусто — BookId неизвестен карте перевода */
  canonicalCode: string
  bookId: number
  chapter: number
  verse: number
}

const miniOptions = {
  processTerm: foldText,
  searchOptions: {
    prefix: true,
    fuzzy: 0.2,
    processTerm: foldText,
  },
}

// ── Песни ──────────────────────────────────────────────

export interface SongSearch {
  /**
   * Песни по запросу. С lang: сначала до limit песен этого языка, за ними —
   * до OTHER_LANG_LIMIT песен других языков, но только тех, что и в общем
   * зачёте вошли бы в первые limit (иначе это шум нечёткого поиска).
   */
  search(query: string, limit?: number, lang?: SongLang): SongRow[]
}

/** Сколько песен других языков показывать под песнями выбранного */
export const OTHER_LANG_LIMIT = 3

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
    search(query, limit = 8, lang) {
      const q = query.trim()
      if (!q) return []
      // Точный номер песни — всегда первым
      const byNumber = /^\d+$/.test(q) ? songs.filter((s) => s.songNumber === q) : []
      const numbered = new Set(byNumber)
      const hits = index
        .search(q)
        .map((h) => byId.get(h.id as number))
        .filter((s): s is SongRow => !!s && !numbered.has(s))
      const ranked = [...byNumber, ...hits]
      if (!lang) return ranked.slice(0, limit)
      const isOwn = (s: SongRow) => songLangOf(s.id) === lang
      const own = ranked.filter(isOwn).slice(0, limit)
      const other = ranked
        .slice(0, limit)
        .filter((s) => !isOwn(s))
        .slice(0, OTHER_LANG_LIMIT)
      return [...own, ...other]
    },
  }
}

// ── Библия ─────────────────────────────────────────────

export interface VerseSearch {
  build(translation: string, db: BibleDb): void
  has(translation: string): boolean
  search(query: string, translation: string, limit?: number): VerseHit[]
}

/** Изолированный набор стих-индексов (по одному на перевод) */
export function createVerseSearch(): VerseSearch {
  const indexes = new Map<string, MiniSearch<VerseHit>>()
  const docsByTranslation = new Map<string, Map<string, VerseHit>>()

  return {
    build(translation, db) {
      if (indexes.has(translation)) return
      const index = new MiniSearch<VerseHit>({
        fields: ['text'],
        ...miniOptions,
      })
      const docs = new Map<string, VerseHit>()
      const all: VerseHit[] = []
      for (const book of db.Books) {
        const code = codeForBookId(translation, book.BookId)
        const title = code ? bookTitleIn(code, translation) : `Книга ${book.BookId}`
        for (const chapter of book.Chapters) {
          for (const verse of chapter.Verses) {
            const id = `${book.BookId}:${chapter.ChapterId}:${verse.VerseId}`
            // В исходных данных встречаются задвоенные VerseId (напр. Пс 12:6 в РСТ)
            if (docs.has(id)) continue
            const doc: VerseHit = {
              id,
              ref: `${title} ${chapter.ChapterId}:${verse.VerseId}`,
              text: stripMarkup(verse.Text),
              canonicalCode: code ?? '',
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
