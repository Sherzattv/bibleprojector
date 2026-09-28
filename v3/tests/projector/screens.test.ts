import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ScreensStore,
  autoPickScreen,
  matchScreen,
  screenTitle,
  toScreenInfo,
  type ScreenDetailedLike,
  type ScreenInfo,
} from '../src/lib/screens.svelte'
import { createMemoryStore, type TextStore } from '../src/lib/storage'

/** Ноутбук оператора */
const internal: ScreenDetailedLike = {
  label: 'Built-in Retina Display',
  left: 0,
  top: 0,
  width: 1440,
  height: 900,
  availLeft: 0,
  availTop: 25,
  availWidth: 1440,
  availHeight: 875,
  isPrimary: true,
  isInternal: true,
}

/** Проектор в зале */
const projector: ScreenDetailedLike = {
  label: 'EPSON PJ',
  left: 1440,
  top: -180,
  width: 1920,
  height: 1080,
  isPrimary: false,
  isInternal: false,
}

function info(s: ScreenDetailedLike, isCurrent = false): ScreenInfo {
  return toScreenInfo(s, isCurrent)
}

function stubHost(opts: {
  getScreenDetails?: () => Promise<unknown>
  permission?: string | 'throws'
}) {
  const win: Record<string, unknown> = {}
  if (opts.getScreenDetails) win.getScreenDetails = opts.getScreenDetails
  vi.stubGlobal('window', win)
  vi.stubGlobal('navigator', {
    permissions: {
      query: () =>
        opts.permission === 'throws'
          ? Promise.reject(new TypeError('unknown permission'))
          : Promise.resolve({ state: opts.permission ?? 'prompt' }),
    },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('toScreenInfo', () => {
  it('для размещения берёт рабочую область (avail*), а не полный прямоугольник', () => {
    const s = info(internal)
    expect([s.left, s.top, s.width, s.height]).toEqual([0, 25, 1440, 875])
  })

  it('без avail* падает обратно на полный прямоугольник', () => {
    const s = info(projector)
    expect([s.left, s.top, s.width, s.height]).toEqual([1440, -180, 1920, 1080])
  })

  it('id различает два одинаковых монитора по позиции', () => {
    const twin = { ...projector, left: 3360 }
    expect(info(projector).id).not.toBe(info(twin).id)
  })

  it('подпись содержит имя и размер, без имени — тип экрана', () => {
    expect(screenTitle(info(projector))).toBe('EPSON PJ · 1920×1080')
    expect(screenTitle(info({ ...projector, label: '' }))).toBe('Монитор · 1920×1080')
    expect(screenTitle(info({ ...internal, label: '' }))).toBe('Встроенный дисплей · 1440×875')
  })
})

describe('matchScreen', () => {
  const list = [info(internal, true), info(projector)]

  it('точное совпадение по id', () => {
    expect(matchScreen(info(projector), list)?.id).toBe(info(projector).id)
  })

  it('монитор переехал в раскладке — узнаём по имени и размеру', () => {
    const moved = { ...projector, left: -1920, top: 0 }
    const saved = info(moved)
    expect(matchScreen(saved, [info(internal, true), info(projector)])?.label).toBe('EPSON PJ')
  })

  it('имя сменилось, позиция та же — узнаём по позиции', () => {
    const renamed = info({ ...projector, label: 'HDMI-1' })
    expect(matchScreen(renamed, list)?.label).toBe('EPSON PJ')
  })

  it('монитор отключили — совпадения нет', () => {
    expect(matchScreen(info(projector), [info(internal, true)])).toBeNull()
  })

  it('пустой список или пустой выбор — null, без исключений', () => {
    expect(matchScreen(null, list)).toBeNull()
    expect(matchScreen(info(projector), [])).toBeNull()
  })
})

describe('autoPickScreen', () => {
  it('выбирает внешний монитор, а не тот, где пульт', () => {
    const picked = autoPickScreen([info(internal, true), info(projector)])
    expect(picked?.label).toBe('EPSON PJ')
  })

  it('единственный монитор не выбирается: окно проектора накрыло бы пульт', () => {
    expect(autoPickScreen([info(internal, true)])).toBeNull()
    expect(autoPickScreen([])).toBeNull()
  })

  it('пульт переехал на проектор — выбирается оставшийся экран', () => {
    const picked = autoPickScreen([info(internal), info(projector, true)])
    expect(picked?.label).toBe('Built-in Retina Display')
  })
})

describe('ScreensStore: запоминание выбора', () => {
  let store: TextStore

  beforeEach(() => {
    store = createMemoryStore()
  })

  it('без выбора и без списка целевого экрана нет', () => {
    expect(new ScreensStore(store).target).toBeNull()
  })

  it('выбор переживает перезапуск пульта', () => {
    const screens = new ScreensStore(store)
    screens.select(info(projector))

    const restored = new ScreensStore(store)
    expect(restored.saved?.label).toBe('EPSON PJ')
    // Список ещё не загружен (нет разрешения) — верим сохранённой геометрии,
    // иначе окно каждый раз открывалось бы на экране пульта
    expect(restored.target?.left).toBe(1440)
  })

  it('сохранённый монитор отключили — целью становится автоподбор', async () => {
    const screens = new ScreensStore(store)
    screens.select(info({ ...projector, label: 'СТАРЫЙ', left: 9000, top: 9000 }))

    const current = { ...internal }
    stubHost({
      permission: 'granted',
      getScreenDetails: async () => ({
        screens: [current, projector],
        currentScreen: current,
      }),
    })
    await screens.refresh()

    expect(screens.target?.label).toBe('EPSON PJ')
  })

  it('select(null) забывает выбор', () => {
    const screens = new ScreensStore(store)
    screens.select(info(projector))
    screens.select(null)
    expect(new ScreensStore(store).saved).toBeNull()
  })

  it('мусор в хранилище → выбора нет, без исключений', () => {
    const garbage: TextStore = { get: () => 'не json {{{', set: () => {}, remove: () => {} }
    let screens!: ScreensStore
    expect(() => {
      screens = new ScreensStore(garbage)
    }).not.toThrow()
    expect(screens.saved).toBeNull()
  })

  it('обрезанная запись (нет размеров) отбрасывается', () => {
    const broken: TextStore = {
      get: () => JSON.stringify({ id: 'x', label: 'EPSON PJ', left: 1440, top: 0 }),
      set: () => {},
      remove: () => {},
    }
    expect(new ScreensStore(broken).saved).toBeNull()
  })
})

describe('ScreensStore: разрешение window-management', () => {
  it('без API — permission=unsupported, список пуст', async () => {
    stubHost({})
    const screens = new ScreensStore(createMemoryStore())
    expect(await screens.refresh({ prompt: true })).toEqual([])
    expect(screens.permission).toBe('unsupported')
  })

  it('refresh() без prompt не дёргает getScreenDetails, пока разрешения нет', async () => {
    const calls: string[] = []
    stubHost({
      permission: 'prompt',
      getScreenDetails: async () => {
        calls.push('getScreenDetails')
        return { screens: [internal], currentScreen: internal }
      },
    })
    const screens = new ScreensStore(createMemoryStore())

    expect(await screens.refresh()).toEqual([])
    expect(calls).toEqual([])
    expect(screens.permission).toBe('prompt')
  })

  it('refresh() без prompt с уже выданным разрешением наполняет список молча', async () => {
    stubHost({
      permission: 'granted',
      getScreenDetails: async () => ({
        screens: [internal, projector],
        currentScreen: internal,
      }),
    })
    const screens = new ScreensStore(createMemoryStore())

    const list = await screens.refresh()
    expect(list.map((s) => s.label)).toEqual(['Built-in Retina Display', 'EPSON PJ'])
    expect(list[0].isCurrent).toBe(true)
    expect(screens.permission).toBe('granted')
  })

  it('отказ оператора — permission=denied, список пуст, без исключений', async () => {
    stubHost({
      permission: 'prompt',
      getScreenDetails: () => Promise.reject(new Error('NotAllowedError')),
    })
    const screens = new ScreensStore(createMemoryStore())

    expect(await screens.refresh({ prompt: true })).toEqual([])
    expect(screens.permission).toBe('denied')
  })

  it('rawFor отдаёт ScreenDetailed выбранного экрана — для requestFullscreen({screen})', async () => {
    stubHost({
      permission: 'granted',
      getScreenDetails: async () => ({
        screens: [internal, projector],
        currentScreen: internal,
      }),
    })
    const screens = new ScreensStore(createMemoryStore())
    await screens.refresh()

    expect(screens.rawFor(screens.target)).toBe(projector)
    expect(screens.rawFor(null)).toBeNull()
  })

  it('screenschange перечитывает список: проектор отключили', async () => {
    let live: ScreenDetailedLike[] = [internal, projector]
    let fire: (() => void) | null = null
    stubHost({
      permission: 'granted',
      getScreenDetails: async () => ({
        screens: live,
        currentScreen: internal,
        addEventListener: (_type: string, listener: () => void) => {
          fire = listener
        },
      }),
    })
    const screens = new ScreensStore(createMemoryStore())
    await screens.refresh()
    expect(screens.list).toHaveLength(2)

    live = [internal]
    fire!()
    await Promise.resolve()
    await Promise.resolve()
    expect(screens.list).toHaveLength(1)
  })
})
