import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  closeDisplayWindow,
  displayFeatures,
  FULLSCREEN_GRANT,
  notifyDisplayReady,
  openDisplayWindow,
  screens,
} from '../src/lib/projector-service.svelte'
import { toScreenInfo, type ScreenDetailedLike } from '../src/lib/screens.svelte'
import { ui } from '../src/lib/ui.svelte'

/** Ноутбук оператора и проектор в зале */
const internal: ScreenDetailedLike = {
  label: 'Built-in',
  left: 0,
  top: 0,
  width: 1440,
  height: 900,
  isPrimary: true,
  isInternal: true,
}
const projector: ScreenDetailedLike = {
  label: 'EPSON PJ',
  left: 1440,
  top: -120,
  width: 1920,
  height: 1080,
}

/** Окно проектора: запоминает, куда его двигали и как растягивали */
class FakeDisplayWindow {
  closed = false
  moves: Array<[number, number]> = []
  resizes: Array<[number, number]> = []
  fullscreens: unknown[] = []
  /** Переданные права развернуться: [сообщение, опции postMessage] */
  grants: Array<[unknown, unknown]> = []
  document = {
    fullscreenElement: null as unknown,
    documentElement: {
      requestFullscreen: (options?: unknown) => {
        this.fullscreens.push(options ?? null)
        return Promise.resolve()
      },
    },
  }
  postMessage(msg: unknown, options: unknown) {
    this.grants.push([msg, options])
  }
  moveTo(x: number, y: number) {
    this.moves.push([x, y])
  }
  resizeTo(w: number, h: number) {
    this.resizes.push([w, h])
  }
  close() {
    this.closed = true
  }
}

interface StubOptions {
  /** что вернёт window.open (null — попап заблокирован) */
  opened: FakeDisplayWindow | null
  /** отсутствует — браузер без Window Management API */
  getScreenDetails?: () => Promise<{ screens: ScreenDetailedLike[]; currentScreen: unknown }>
}

/** Порядок вызовов — главное, что проверяем: open должен идти первым */
let calls: string[] = []
let openArgs: Array<[string, string, string]> = []

function stubWindow(o: StubOptions) {
  calls = []
  openArgs = []
  const win: Record<string, unknown> = {
    location: {
      href: 'https://bibleprojector.example/app/',
      origin: 'https://bibleprojector.example',
    },
    open: (url: string, name: string, features: string) => {
      calls.push('open')
      openArgs.push([url, name, features])
      return o.opened
    },
  }
  if (o.getScreenDetails) {
    win.getScreenDetails = () => {
      calls.push('getScreenDetails')
      return o.getScreenDetails!()
    }
  }
  vi.stubGlobal('window', win)
  // Разрешение уже выдано: refresh({prompt}) идёт в getScreenDetails напрямую
  vi.stubGlobal('navigator', {
    permissions: { query: async () => ({ state: 'granted' }) },
  })
}

/** Дать отработать микрозадачам внутри placeDisplay/enterFullscreen */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  ui.clearNotice()
  // Синглтон переживает файл целиком — выбор монитора не должен течь между тестами
  screens.reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('displayFeatures', () => {
  it('без известного монитора — обычный попап скромного размера', () => {
    expect(displayFeatures(null)).toBe('popup,width=1024,height=768')
  })

  it('на известном мониторе — сразу его прямоугольник', () => {
    expect(displayFeatures(toScreenInfo(projector, false))).toBe(
      'popup,left=1440,top=-120,width=1920,height=1080',
    )
  })
})

describe('openDisplayWindow', () => {
  it('открывает окно синхронно, не дожидаясь getScreenDetails', () => {
    const display = new FakeDisplayWindow()
    // запрос разрешения Window Management висит до ответа оператора
    stubWindow({ opened: display, getScreenDetails: () => new Promise(() => {}) })

    openDisplayWindow()

    // окно уже открыто, хотя разрешение ещё не дано —
    // transient activation не успевает истечь
    expect(calls).toEqual(['open', 'getScreenDetails'])
  })

  it('открывает адрес текущей страницы с хэшем #display в именованном окне', () => {
    stubWindow({ opened: new FakeDisplayWindow() })

    openDisplayWindow()

    const [url, name, features] = openArgs[0]
    expect(url).toBe('https://bibleprojector.example/app/#display')
    expect(name).toBe('bp3-display')
    expect(features).toContain('width=')
  })

  it('запомненный монитор задаётся сразу в window.open, до всякого разрешения', () => {
    screens.select(toScreenInfo(projector, false))
    stubWindow({
      opened: new FakeDisplayWindow(),
      getScreenDetails: () => new Promise(() => {}),
    })

    openDisplayWindow()

    expect(openArgs[0][2]).toBe('popup,left=1440,top=-120,width=1920,height=1080')
  })

  it('явно выбранный монитор запоминается для следующего раза', () => {
    stubWindow({
      opened: new FakeDisplayWindow(),
      getScreenDetails: () => new Promise(() => {}),
    })

    openDisplayWindow(toScreenInfo(projector, false))

    expect(screens.saved?.label).toBe('EPSON PJ')
    expect(openArgs[0][2]).toContain('left=1440')
  })

  it('после получения разрешения переносит окно на внешний монитор', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({
        screens: [internal, projector],
        currentScreen: internal,
      }),
    })

    openDisplayWindow()
    await flush()

    expect(display.moves).toEqual([[1440, -120]])
    expect(display.resizes).toEqual([[1920, 1080]])
    // Автоподбор запоминается: следующее открытие попадёт сюда сразу
    expect(screens.saved?.label).toBe('EPSON PJ')
  })

  it('единственный монитор — окно не растягивают: оно накрыло бы сам пульт', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({ screens: [internal], currentScreen: internal }),
    })

    openDisplayWindow()
    await flush()

    expect(display.moves).toEqual([])
    expect(display.resizes).toEqual([])
  })

  it('отказ в разрешении не ломает уже открытое окно и не даёт уведомления', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({
      opened: display,
      getScreenDetails: () => Promise.reject(new Error('NotAllowedError')),
    })

    expect(() => openDisplayWindow()).not.toThrow()
    await flush()

    expect(display.moves).toEqual([])
    expect(ui.lastNotice).toBeNull()
  })

  it('закрытое к моменту ответа окно не двигаем', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({
        screens: [internal, projector],
        currentScreen: internal,
      }),
    })

    openDisplayWindow()
    display.closed = true
    await flush()

    expect(display.moves).toEqual([])
    expect(display.resizes).toEqual([])
  })

  it('браузер без Window Management API просто открывает окно', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({ opened: display })

    openDisplayWindow()
    await flush()

    expect(calls).toEqual(['open'])
    expect(display.moves).toEqual([])
    expect(ui.lastNotice).toBeNull()
  })

  it('попап заблокирован (open === null) — оператор видит уведомление', () => {
    stubWindow({
      opened: null,
      getScreenDetails: async () => ({ screens: [], currentScreen: null }),
    })

    openDisplayWindow()

    expect(ui.lastNotice).toBeTruthy()
    expect(ui.lastNotice).toContain('всплывающие окна')
    // за разрешением не идём: показывать нечего
    expect(calls).toEqual(['open'])
  })
})

describe('openDisplayWindow: полный экран', () => {
  it('готовый экран разворачивается на выбранном мониторе', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({
        screens: [internal, projector],
        currentScreen: internal,
      }),
    })

    openDisplayWindow()
    await flush()
    expect(display.fullscreens).toEqual([]) // экран ещё не доложил о готовности

    notifyDisplayReady()
    await flush()

    // ScreenDetailed нужного монитора уезжает в requestFullscreen({ screen })
    expect(display.fullscreens).toEqual([{ screen: projector }])
  })

  it('вместе с разворачиванием экрану передаётся право на fullscreen', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({
        screens: [internal, projector],
        currentScreen: internal,
      }),
    })

    openDisplayWindow()
    await flush()
    notifyDisplayReady()
    await flush()

    // Без delegate экран получает просьбу, но не право её исполнить:
    // requestFullscreen требует жеста в своём документе, а клик был в пульте
    expect(display.grants).toEqual([
      [
        FULLSCREEN_GRANT,
        { targetOrigin: 'https://bibleprojector.example', delegate: 'fullscreen' },
      ],
    ])
  })

  it('единственный монитор не разворачивают', async () => {
    const display = new FakeDisplayWindow()
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({ screens: [internal], currentScreen: internal }),
    })

    openDisplayWindow()
    await flush()
    notifyDisplayReady()
    await flush()

    expect(display.fullscreens).toEqual([])
  })

  it('уже развёрнутое окно не двигают и не разворачивают повторно', async () => {
    const display = new FakeDisplayWindow()
    display.document.fullscreenElement = {}
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({
        screens: [internal, projector],
        currentScreen: internal,
      }),
    })

    openDisplayWindow()
    await flush()
    notifyDisplayReady()
    await flush()

    expect(display.moves).toEqual([])
    expect(display.fullscreens).toEqual([])
  })
})

describe('closeDisplayWindow', () => {
  it('закрывает открытое окно проектора', () => {
    const display = new FakeDisplayWindow()
    stubWindow({ opened: display })

    openDisplayWindow()
    expect(display.closed).toBe(false)

    closeDisplayWindow()
    expect(display.closed).toBe(true)
  })

  it('без открытого окна не бросает', () => {
    stubWindow({ opened: null })
    expect(() => closeDisplayWindow()).not.toThrow()
  })
})
