import { describe, it, expect, vi } from 'vitest'
import {
  loadManifest,
  loadDataFile,
  type KVStore,
  type DataManifest,
} from '../src/lib/data-cache'

/** Фейковое KV-хранилище: Map + журнал вызовов get/set */
class FakeKV implements KVStore {
  map = new Map<string, string>()
  log: Array<[op: 'get' | 'set', key: string]> = []

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.map.set(k, v)
  }

  async get(key: string): Promise<string | null> {
    this.log.push(['get', key])
    return this.map.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.log.push(['set', key])
    this.map.set(key, value)
  }
}

const okFetch = (body: string) => vi.fn(async (_url: string) => body)
const deadFetch = () => vi.fn(async (_url: string): Promise<string> => {
  throw new Error('сеть недоступна')
})

const manifest: DataManifest = {
  version: '2026-07-25',
  files: {
    songs: { hash: 'abc123' },
    rst: { hash: 'def456' },
  },
}
const manifestRaw = JSON.stringify(manifest)

// Маленькие JSON-фикстуры с кириллицей
const freshSongs = { песни: ['Благодать', 'Аллилуйя'] }
const freshSongsRaw = JSON.stringify(freshSongs)
const staleSongs = { песни: ['Старая песня'] }
const staleSongsRaw = JSON.stringify(staleSongs)

describe('loadManifest — network-first', () => {
  it('сеть ок: парсит JSON, кладёт сырую строку в kv[manifest], fromCache=false', async () => {
    const kv = new FakeKV()
    const fetchText = okFetch(manifestRaw)

    const result = await loadManifest('data/manifest.json', kv, fetchText)

    expect(result.fromCache).toBe(false)
    expect(result.manifest).toEqual(manifest)
    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(fetchText).toHaveBeenCalledWith('data/manifest.json')
    expect(kv.map.get('manifest')).toBe(manifestRaw)
  })

  it('сеть упала, кэш есть: возвращает кэшированный манифест, fromCache=true', async () => {
    const kv = new FakeKV({ manifest: manifestRaw })
    const fetchText = deadFetch()

    const result = await loadManifest('data/manifest.json', kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1) // попытка сети была
    expect(result.fromCache).toBe(true)
    expect(result.manifest).toEqual(manifest)
  })

  it('сеть упала и кэша нет: reject', async () => {
    const kv = new FakeKV()
    const fetchText = deadFetch()

    await expect(loadManifest('data/manifest.json', kv, fetchText)).rejects.toThrow()
    expect(fetchText).toHaveBeenCalledTimes(1)
  })
})

describe('loadDataFile — cache-first по хэшу', () => {
  it('хэш совпадает: отдаёт кэш, fetchText не вызывался', async () => {
    const kv = new FakeKV({ 'hash:songs': 'abc123', 'file:songs': staleSongsRaw })
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(result).toEqual(staleSongs)
    expect(fetchText).not.toHaveBeenCalled()
    // содержимое kv не изменилось
    expect(kv.map.get('file:songs')).toBe(staleSongsRaw)
    expect(kv.map.get('hash:songs')).toBe('abc123')
  })

  it('хэш устарел: скачивает, сохраняет содержимое и новый хэш, отдаёт свежее', async () => {
    const kv = new FakeKV({ 'hash:songs': 'old000', 'file:songs': staleSongsRaw })
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(fetchText).toHaveBeenCalledWith('data/songs.json')
    expect(result).toEqual(freshSongs)
    expect(kv.map.get('file:songs')).toBe(freshSongsRaw)
    expect(kv.map.get('hash:songs')).toBe('abc123')
  })

  it('kv пуст: скачивает, сохраняет, возвращает', async () => {
    const kv = new FakeKV()
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(result).toEqual(freshSongs)
    expect(kv.map.get('file:songs')).toBe(freshSongsRaw)
    expect(kv.map.get('hash:songs')).toBe('abc123')
  })

  it('сеть упала, но кэш есть (даже с устаревшим хэшем): stale-фоллбек, не бросает', async () => {
    const kv = new FakeKV({ 'hash:songs': 'old000', 'file:songs': staleSongsRaw })
    const fetchText = deadFetch()

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(result).toEqual(staleSongs)
    // устаревший кэш не подменён и не потёрт
    expect(kv.map.get('file:songs')).toBe(staleSongsRaw)
  })

  it('сеть упала и кэша нет: reject', async () => {
    const kv = new FakeKV()
    const fetchText = deadFetch()

    await expect(
      loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText),
    ).rejects.toThrow()
    expect(fetchText).toHaveBeenCalledTimes(1)
  })

  it('имени нет в manifest.files: качает и сохраняет как «нет кэша»', async () => {
    const kv = new FakeKV()
    const extra = { заметки: 'без манифеста' }
    const extraRaw = JSON.stringify(extra)
    const fetchText = okFetch(extraRaw)

    const result = await loadDataFile('notes', 'data/notes.json', manifest, kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(result).toEqual(extra)
    expect(kv.map.get('file:notes')).toBe(extraRaw)
  })

  it('имени нет в манифесте, сеть упала, но file-кэш есть: отдаёт кэш', async () => {
    const kv = new FakeKV({ 'file:notes': staleSongsRaw })
    const fetchText = deadFetch()

    const result = await loadDataFile('notes', 'data/notes.json', manifest, kv, fetchText)

    expect(result).toEqual(staleSongs)
    expect(kv.map.get('file:notes')).toBe(staleSongsRaw)
  })
})
