/**
 * Единственный экземпляр SearchClient поверх Web Worker.
 * Компоненты берут клиента отсюда; данные проталкиваются по мере загрузки.
 */
import SearchWorker from './search.worker?worker&inline'
import { SearchClient, type SearchTransport } from './search-client.svelte'
import type { BibleDb, SongRow } from './db.svelte'

let client: SearchClient | null = null
const pushedBibles = new Set<string>()
let pushedSongs = false

function workerTransport(): SearchTransport {
  const worker = new SearchWorker()
  const transport: SearchTransport = {
    post: (msg) => worker.postMessage(msg),
    onmessage: null,
  }
  worker.onmessage = (e) => transport.onmessage?.(e.data)
  return transport
}

export function getSearchClient(): SearchClient {
  if (!client) client = new SearchClient(workerTransport())
  return client
}

/** Отдать песни воркеру (один раз) */
export function pushSongs(songs: SongRow[]) {
  if (pushedSongs || !songs.length) return
  getSearchClient().setSongs(songs)
  pushedSongs = true
}

/** Отдать перевод воркеру для индексации (один раз на перевод) */
export function pushBible(translation: string, db: BibleDb | null) {
  if (!db || pushedBibles.has(translation)) return
  getSearchClient().setBible(translation, db)
  pushedBibles.add(translation)
}
