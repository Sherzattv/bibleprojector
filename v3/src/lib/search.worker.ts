/**
 * Поисковый Web Worker: тонкая обёртка над чистым бэкендом.
 * Вся индексация и поиск — вне главного потока.
 */
import { createSearchBackend, type BackendRequest } from './search-backend'

const backend = createSearchBackend()

self.onmessage = (e: MessageEvent<BackendRequest>) => {
  self.postMessage(backend.handle(e.data))
}
