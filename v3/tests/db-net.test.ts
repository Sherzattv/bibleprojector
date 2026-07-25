import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { data, createFetchText } from '../src/lib/db.svelte'
import { rstDb, nrtDb, songs } from './fixtures'

// Сетевой слой стора: content-type, таймаут и повтор стартовой загрузки.
// Кэш-логика — в data-cache.test.ts.

/** Ответ настоящего вида: с headers и text() */
const res = (body: unknown, type = 'application/json') =>
  Promise.resolve({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': type }),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createFetchText — content-type', () => {
  it('application/json проходит', async () => {
    vi.stubGlobal('fetch', vi.fn(() => res({ ок: true })))
    await expect(createFetchText()('data/songs.json')).resolves.toBe('{"ок":true}')
  })

  it('200 + text/html (лендинг Cloudflare на неизвестном пути) — reject', async () => {
    vi.stubGlobal('fetch', vi.fn(() => res('<!doctype html><html></html>', 'text/html')))
    await expect(createFetchText()('data/songs.json')).rejects.toThrow(/JSON/)
  })

  it('мок без headers (только json()) — проверка пропускается, совместимость цела', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ок: true }) })),
    )
    await expect(createFetchText()('data/songs.json')).resolves.toBe('{"ок":true}')
  })

  it('r.ok=false — reject с кодом', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 404 })),
    )
    await expect(createFetchText()('data/songs.json')).rejects.toThrow(/404/)
  })
})

describe('createFetchText — таймаут', () => {
  it('зависшая сеть обрывается по AbortSignal, а не висит вечно', async () => {
    // Мок уважает signal: без таймаута этот промис не разрешился бы никогда
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
          }),
      ),
    )
    await expect(createFetchText(20)('data/songs.json')).rejects.toThrow()
  })

  it('signal передаётся в fetch', async () => {
    const impl = vi.fn(() => res({ ок: true }))
    vi.stubGlobal('fetch', impl)
    await createFetchText()('data/songs.json')
    const init = impl.mock.calls[0]?.[1] as { signal?: AbortSignal } | undefined
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })
})

describe('data.retryInit', () => {
  beforeEach(() => {
    // data — синглтон, сбрасываем состояние между тестами
    data.bibles = {}
    data.songs = []
    data.translation = 'RST'
    data.status = 'loading'
    data.translationStatus = {}
  })

  it('после провала стартовой загрузки повтор доводит status до ready', async () => {
    let broken = true
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (broken) return Promise.reject(new Error('network down'))
        if (url.endsWith('songs.json')) return res(songs)
        if (url.endsWith('rst.json')) return res(rstDb)
        if (url.endsWith('manifest.json')) return res({ version: '1', files: {} })
        return res(nrtDb)
      }),
    )

    await data.init()
    expect(data.status).toBe('error')

    broken = false
    await data.retryInit()

    expect(data.status).toBe('ready')
    expect(data.bibles.RST).toBeDefined()
    expect(data.songs).toHaveLength(songs.length)
  })

  it('пока повтор идёт, status снова loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    await data.init()
    expect(data.status).toBe('error')

    const pending = data.retryInit()
    expect(data.status).toBe('loading')
    await pending
    expect(data.status).toBe('error')
  })
})
