/**
 * Ядро поискового Web Worker — чистый модуль без Worker API,
 * тестируется в node (tests/search-backend.test.ts).
 * Воркер (search.worker.ts) — тонкая обёртка onmessage → handle.
 */
import {
  createSongSearch,
  createVerseSearch,
  makeTitleGetter,
  type SongSearch,
  type VerseHit,
} from './search'
import type { BibleDb, SongRow } from './db.svelte'

export type BackendRequest =
  | { seq: number; type: 'set-songs'; songs: SongRow[] }
  | { seq: number; type: 'set-bible'; translation: string; db: BibleDb }
  | { seq: number; type: 'search'; query: string; translation: string }

export type BackendResponse =
  | { seq: number; type: 'ready'; what: 'songs' | 'bible'; translation?: string }
  | {
      seq: number
      type: 'results'
      query: string
      songs: SongRow[]
      verses: VerseHit[]
      verseIndexReady: boolean
    }

export interface SearchBackend {
  handle(req: BackendRequest): BackendResponse
}

export function createSearchBackend(): SearchBackend {
  let songSearch: SongSearch | null = null
  const verseSearch = createVerseSearch()

  return {
    handle(req) {
      switch (req.type) {
        case 'set-songs':
          songSearch = createSongSearch(req.songs)
          return { seq: req.seq, type: 'ready', what: 'songs' }

        case 'set-bible':
          verseSearch.build(req.translation, req.db, makeTitleGetter(req.translation))
          return { seq: req.seq, type: 'ready', what: 'bible', translation: req.translation }

        case 'search':
          return {
            seq: req.seq,
            type: 'results',
            query: req.query,
            songs: songSearch ? songSearch.search(req.query) : [],
            verses: verseSearch.search(req.query, req.translation),
            verseIndexReady: verseSearch.has(req.translation),
          }
      }
    },
  }
}
