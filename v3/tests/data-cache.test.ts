import { describe, it, expect, vi } from 'vitest'
import { createHash } from 'node:crypto'
import {
  loadManifest,
  loadDataFile,
  hashContent,
  type KVStore,
  type DataManifest,
} from '../src/lib/data-cache'

/** Фейковое KV-хранилище: Map + журнал вызовов get/set/delete */
class FakeKV implements KVStore {
  map = new Map<string, string>()
  log: Array<[op: 'get' | 'set' | 'delete', key: string]> = []
  /** Ключи, запись в которые бросает (квота, приватный режим) */
  failSet = new Set<string>()

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.map.set(k, v)
  }

  async get(key: string): Promise<string | null> {
    this.log.push(['get', key])
    return this.map.get(key) ?? null
  }

  async set(key: string, value: string): Promise<void> {
    this.log.push(['set', key])
    if (this.failSet.has(key)) throw new Error('QuotaExceededError')
    this.map.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.log.push(['delete', key])
    this.map.delete(key)
  }
}

const okFetch = (body: string) => vi.fn(async (_url: string) => body)
const deadFetch = () => vi.fn(async (_url: string): Promise<string> => {
  throw new Error('сеть недоступна')
})

/** Эталон из scripts/convert-core.mjs — hashContent при сборке манифеста */
const sha16 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)

// Маленькие JSON-фикстуры с кириллицей
const freshSongs = { песни: ['Благодать', 'Аллилуйя'] }
const freshSongsRaw = JSON.stringify(freshSongs)
const staleSongs = { песни: ['Старая песня'] }
const staleSongsRaw = JSON.stringify(staleSongs)
// Лендинг вместо данных: Cloudflare отдаёт его с кодом 200 на любой неизвестный путь
const landingHtml = '<!doctype html><html><body>Bible Projector</body></html>'

const songsHash = sha16(freshSongsRaw)
const manifest: DataManifest = {
  version: '2026-07-25',
  files: {
    songs: { hash: songsHash },
    rst: { hash: 'def456' },
  },
}
const manifestRaw = JSON.stringify(manifest)

describe('hashContent', () => {
  it('совпадает с хэшем из convert-core.mjs (sha256, первые 16 hex)', async () => {
    expect(await hashContent(freshSongsRaw)).toBe(sha16(freshSongsRaw))
    expect(await hashContent('')).toBe(sha16(''))
  })

  it('без crypto.subtle не бросает, а возвращает null', async () => {
    vi.stubGlobal('crypto', {})
    try {
      expect(await hashContent(freshSongsRaw)).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

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

  it('200 + HTML вместо манифеста: не пишет в кэш и бросает', async () => {
    const kv = new FakeKV()
    const fetchText = okFetch(landingHtml)

    await expect(loadManifest('data/manifest.json', kv, fetchText)).rejects.toThrow()
    expect(kv.map.has('manifest')).toBe(false)
  })

  it('битый кэш манифеста удаляется, ошибка сети не становится вечной', async () => {
    const kv = new FakeKV({ manifest: landingHtml })
    const fetchText = deadFetch()

    await expect(loadManifest('data/manifest.json', kv, fetchText)).rejects.toThrow()
    expect(kv.map.has('manifest')).toBe(false)
  })

  it('сбой записи в кэш не отменяет удачную загрузку', async () => {
    const kv = new FakeKV()
    kv.failSet.add('manifest')
    const fetchText = okFetch(manifestRaw)

    const result = await loadManifest('data/manifest.json', kv, fetchText)

    expect(result.manifest).toEqual(manifest)
    expect(result.fromCache).toBe(false)
  })
})

describe('loadDataFile — cache-first по хэшу', () => {
  it('хэш совпадает: отдаёт кэш, fetchText не вызывался', async () => {
    const kv = new FakeKV({ 'hash:songs': songsHash, 'file:songs': staleSongsRaw })
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(result).toEqual(staleSongs)
    expect(fetchText).not.toHaveBeenCalled()
    // содержимое kv не изменилось
    expect(kv.map.get('file:songs')).toBe(staleSongsRaw)
    expect(kv.map.get('hash:songs')).toBe(songsHash)
  })

  it('хэш устарел: скачивает, сохраняет содержимое и новый хэш, отдаёт свежее', async () => {
    const kv = new FakeKV({ 'hash:songs': 'old000', 'file:songs': staleSongsRaw })
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(fetchText).toHaveBeenCalledWith('data/songs.json')
    expect(result).toEqual(freshSongs)
    expect(kv.map.get('file:songs')).toBe(freshSongsRaw)
    expect(kv.map.get('hash:songs')).toBe(songsHash)
  })

  it('kv пуст: скачивает, сохраняет, возвращает', async () => {
    const kv = new FakeKV()
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1)
    expect(result).toEqual(freshSongs)
    expect(kv.map.get('file:songs')).toBe(freshSongsRaw)
    expect(kv.map.get('hash:songs')).toBe(songsHash)
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

describe('loadDataFile — 200 + HTML не отравляет кэш', () => {
  it('пустой kv: HTML не сохраняется ни как файл, ни как хэш, ошибка наружу', async () => {
    const kv = new FakeKV()
    const fetchText = okFetch(landingHtml)

    await expect(
      loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText),
    ).rejects.toThrow()
    expect(kv.map.has('file:songs')).toBe(false)
    expect(kv.map.has('hash:songs')).toBe(false)
  })

  it('есть устаревший кэш: HTML игнорируется, отдаётся stale, кэш цел', async () => {
    const kv = new FakeKV({ 'hash:songs': 'old000', 'file:songs': staleSongsRaw })
    const fetchText = okFetch(landingHtml)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(result).toEqual(staleSongs)
    expect(kv.map.get('file:songs')).toBe(staleSongsRaw)
    expect(kv.map.get('hash:songs')).toBe('old000')
  })
})

describe('loadDataFile — самовосстановление битого кэша', () => {
  it('кэш с «правильным» хэшем, но не-JSON телом: чистится и перекачивается', async () => {
    const kv = new FakeKV({ 'hash:songs': songsHash, 'file:songs': landingHtml })
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(fetchText).toHaveBeenCalledTimes(1) // быстрый путь не заклинил
    expect(result).toEqual(freshSongs)
    expect(kv.log).toContainEqual(['delete', 'file:songs'])
    expect(kv.map.get('file:songs')).toBe(freshSongsRaw)
    expect(kv.map.get('hash:songs')).toBe(songsHash)
  })

  it('битый кэш + мёртвая сеть: битая запись удалена, ошибка сети наружу', async () => {
    const kv = new FakeKV({ 'hash:songs': songsHash, 'file:songs': landingHtml })
    const fetchText = deadFetch()

    await expect(
      loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText),
    ).rejects.toThrow('сеть недоступна')
    expect(kv.map.has('file:songs')).toBe(false)
    expect(kv.map.has('hash:songs')).toBe(false)
  })
})

describe('loadDataFile — сбой кэша не мешает данным', () => {
  it('kv.set бросает (квота): данные всё равно возвращаются', async () => {
    const kv = new FakeKV()
    kv.failSet.add('file:songs')
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(result).toEqual(freshSongs)
    // тело не легло — хэш писать нельзя, иначе кэш «подтвердит» несуществующий файл
    expect(kv.map.has('hash:songs')).toBe(false)
  })

  it('kv.get бросает (SecurityError): работает как при пустом кэше', async () => {
    const kv = new FakeKV()
    kv.get = async () => {
      throw new Error('SecurityError')
    }
    const fetchText = okFetch(freshSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(result).toEqual(freshSongs)
  })
})

describe('loadDataFile — хэш считается от тела', () => {
  it('тело не совпало с манифестом (старая копия из прокси): хэш не коммитится', async () => {
    const kv = new FakeKV()
    // Сеть отдала staleSongsRaw, а манифест обещал хэш freshSongsRaw
    const fetchText = okFetch(staleSongsRaw)

    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)

    expect(result).toEqual(staleSongs)
    expect(kv.map.get('file:songs')).toBe(staleSongsRaw)
    // хэша нет — на следующем старте файл перекачается, а не «застрянет» навсегда
    expect(kv.map.has('hash:songs')).toBe(false)
  })

  it('тело совпало: хэш коммитится, следующий старт идёт из кэша', async () => {
    const kv = new FakeKV()
    const fetchText = okFetch(freshSongsRaw)

    await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)
    expect(kv.map.get('hash:songs')).toBe(songsHash)

    const second = okFetch(freshSongsRaw)
    const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, second)

    expect(second).not.toHaveBeenCalled()
    expect(result).toEqual(freshSongs)
  })

  it('без crypto.subtle сверить нечем — доверяем манифесту и пишем хэш', async () => {
    const kv = new FakeKV()
    const fetchText = okFetch(staleSongsRaw)
    vi.stubGlobal('crypto', {})
    try {
      const result = await loadDataFile('songs', 'data/songs.json', manifest, kv, fetchText)
      expect(result).toEqual(staleSongs)
      expect(kv.map.get('hash:songs')).toBe(songsHash)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
