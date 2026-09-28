import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { data } from '../src/lib/db.svelte'
import { rstDb, nrtDb, songs } from './fixtures'

// В тестах MODE='test', IS_DEMO=false — работает fetch-ветка init()

const ok = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
const notOk = () =>
  Promise.resolve({ ok: false, status: 404, json: () => Promise.reject(new Error('404')) })

/** Мок fetch: отвечает по хвосту URL, по умолчанию всё успешно */
function stubFetch(overrides: Record<string, () => Promise<unknown>> = {}) {
  const impl = vi.fn((url: string) => {
    for (const [suffix, handler] of Object.entries(overrides)) {
      if (url.endsWith(suffix)) return handler()
    }
    if (url.endsWith('songs.json')) return ok(songs)
    if (url.endsWith('rst.json')) return ok(rstDb)
    return ok(nrtDb) // остальные переводы
  })
  vi.stubGlobal('fetch', impl)
  return impl
}

beforeEach(() => {
  // data — синглтон, сбрасываем состояние между тестами
  data.bibles = {}
  data.songs = []
  data.translation = 'RST'
  data.status = 'loading'
  data.translationStatus = {}
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('data.init — основная загрузка', () => {
  it('успешные rst+songs дают status ready', async () => {
    stubFetch()
    await data.init()
    expect(data.status).toBe('ready')
    expect(data.bibles.RST).toBeDefined()
    expect(data.songs).toHaveLength(songs.length)
  })

  it('упавший основной fetch — status error, без unhandled rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )
    await expect(data.init()).resolves.toBeUndefined()
    expect(data.status).toBe('error')
  })
})

describe('data.translationStatus — фоновые переводы', () => {
  it('удачная фоновая загрузка — статус ready, перевод в bibles', async () => {
    stubFetch()
    await data.init()
    await vi.waitFor(() => {
      expect(data.translationStatus.NRT).toBe('ready')
    })
    expect(data.bibles.NRT).toBeDefined()
  })

  it('ответ r.ok=false — статус error, процесс не падает', async () => {
    stubFetch({ 'nrt.json': notOk })
    await data.init()
    await vi.waitFor(() => {
      expect(data.translationStatus.NRT).toBe('error')
    })
    expect(data.status).toBe('ready') // основная загрузка не пострадала
    expect(data.bibles.NRT).toBeUndefined()
  })

  it('reject фонового fetch — статус error, процесс не падает', async () => {
    stubFetch({ 'ktb.json': () => Promise.reject(new Error('offline')) })
    await data.init()
    await vi.waitFor(() => {
      expect(data.translationStatus.KTB).toBe('error')
    })
    expect(data.status).toBe('ready')
    // соседний перевод при этом догрузился
    await vi.waitFor(() => {
      expect(data.translationStatus.NRT).toBe('ready')
    })
  })
})

describe('data.retryTranslation', () => {
  it('после успешного ретрая статус ready и перевод доступен', async () => {
    let broken = true
    stubFetch({ 'nrt.json': () => (broken ? notOk() : ok(nrtDb)) })
    await data.init()
    await vi.waitFor(() => {
      expect(data.translationStatus.NRT).toBe('error')
    })

    broken = false
    await data.retryTranslation('NRT')

    expect(data.translationStatus.NRT).toBe('ready')
    expect(data.bibles.NRT).toBeDefined()
  })
})
