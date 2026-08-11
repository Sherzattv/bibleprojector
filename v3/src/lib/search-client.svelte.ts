/**
 * Клиент поиска на главном потоке: debounce ввода, возрастающие seq,
 * отбрасывание устаревших ответов. Транспорт абстрагирован —
 * в приложении это Web Worker, в тестах — фейк.
 */
import type { SongRow } from './db.svelte'
import type { VerseHit } from './search'

export interface SearchTransport {
  post(msg: unknown): void
  onmessage: ((msg: unknown) => void) | null
}

export interface SearchResults {
  songs: SongRow[]
  verses: VerseHit[]
}

interface ResultsMsg {
  type: 'results'
  seq: number
  songs: SongRow[]
  verses: VerseHit[]
  verseIndexReady: boolean
  query: string
}

const EMPTY: SearchResults = { songs: [], verses: [] }

export class SearchClient {
  results = $state<SearchResults>(EMPTY)
  indexing = $state(false)

  private transport: SearchTransport
  private debounceMs: number
  private seq = 0
  private lastSearchSeq = -1
  private lastSearchQuery = ''
  private pending: { query: string; translation: string } | null = null
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(transport: SearchTransport, opts: { debounceMs?: number } = {}) {
    this.transport = transport
    this.debounceMs = opts.debounceMs ?? 120
    transport.onmessage = (msg) => this.onMessage(msg)
  }

  setSongs(songs: SongRow[]) {
    this.transport.post({ seq: this.seq++, type: 'set-songs', songs })
  }

  setBible(translation: string, db: unknown) {
    this.transport.post({ seq: this.seq++, type: 'set-bible', translation, db })
  }

  search(query: string, translation: string) {
    if (!query.trim()) {
      this.cancelPending()
      // Запрос уже в пути — его ответ больше не наш: без сброса seq он
      // вернёт в results выдачу отменённого запроса
      this.lastSearchSeq = -1
      this.lastSearchQuery = ''
      this.results = EMPTY
      this.indexing = false
      return
    }
    this.pending = { query, translation }
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.sendPending(), this.debounceMs)
  }

  /** Отправить отложенный запрос немедленно (например, по Enter) */
  flush() {
    if (this.pending) this.sendPending()
  }

  private cancelPending() {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.pending = null
  }

  private sendPending() {
    if (!this.pending) return
    const { query, translation } = this.pending
    this.cancelPending()
    this.lastSearchSeq = this.seq++
    this.lastSearchQuery = query
    this.transport.post({ seq: this.lastSearchSeq, type: 'search', query, translation })
  }

  private onMessage(msg: unknown) {
    const m = msg as Partial<ResultsMsg>
    if (m.type !== 'results') return
    // Запоздавшие ответы (не последний отправленный запрос) игнорируются
    if (m.seq !== this.lastSearchSeq) return
    this.results = { songs: m.songs ?? [], verses: m.verses ?? [] }
    this.indexing = !m.verseIndexReady && this.lastSearchQuery.trim().length >= 3
  }
}
