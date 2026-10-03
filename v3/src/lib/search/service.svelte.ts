/**
 * Единственный экземпляр SearchClient поверх Web Worker.
 * Компоненты берут клиента отсюда; данные проталкиваются по мере загрузки.
 */
import SearchWorker from './worker?worker&inline'
import { SearchClient, type SearchTransport } from './client.svelte'
import type { BibleDb, SongRow } from '../data/db.svelte'

let client: SearchClient | null = null
const pushedBibles = new Set<string>()
let pushedSongs: readonly SongRow[] | null = null

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

/**
 * Отдать песни воркеру. Каталог заменяется целиком, только когда он
 * изменился: догрузилась база ещё одного языка после повтора
 */
export function pushSongs(songs: SongRow[]) {
  if (songs === pushedSongs || !songs.length) return
  getSearchClient().setSongs(songs)
  pushedSongs = songs
}

/** Отдать перевод воркеру для индексации (один раз на перевод) */
export function pushBible(translation: string, db: BibleDb | null) {
  if (!db || pushedBibles.has(translation)) return
  getSearchClient().setBible(translation, db)
  pushedBibles.add(translation)
}
