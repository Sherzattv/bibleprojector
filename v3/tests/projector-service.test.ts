import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { openDisplayWindow } from '../src/lib/projector-service.svelte'
import { ui } from '../src/lib/ui.svelte'

interface ScreenLike {
  left: number
  top: number
  width: number
  height: number
}

/** Окно проектора: запоминает, куда его двигали и как растягивали */
class FakeDisplayWindow {
  closed = false
  moves: Array<[number, number]> = []
  resizes: Array<[number, number]> = []
  moveTo(x: number, y: number) {
    this.moves.push([x, y])
  }
  resizeTo(w: number, h: number) {
    this.resizes.push([w, h])
  }
}

interface StubOptions {
  /** что вернёт window.open (null — попап заблокирован) */
  opened: FakeDisplayWindow | null
  /** отсутствует — браузер без Window Management API */
  getScreenDetails?: () => Promise<{ screens: ScreenLike[]; currentScreen: unknown }>
}

/** Порядок вызовов — главное, что проверяем: open должен идти первым */
let calls: string[] = []
let openArgs: Array<[string, string, string]> = []

function stubWindow(o: StubOptions) {
  calls = []
  openArgs = []
  const win: Record<string, unknown> = {
    location: { href: 'https://bibleprojector.example/app/' },
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
}

/** Дать отработать микрозадачам внутри moveToExternalScreen */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  ui.clearNotice()
})

afterEach(() => {
  vi.unstubAllGlobals()
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

  it('после получения разрешения переносит окно на внешний монитор', async () => {
    const display = new FakeDisplayWindow()
    const current = { left: 0, top: 0, width: 1440, height: 900 }
    const external = { left: 1440, top: -120, width: 1920, height: 1080 }
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({ screens: [current, external], currentScreen: current }),
    })

    openDisplayWindow()
    await flush()

    expect(display.moves).toEqual([[1440, -120]])
    expect(display.resizes).toEqual([[1920, 1080]])
  })

  it('единственный монитор — окно позиционируется по нему, без исключений', async () => {
    const display = new FakeDisplayWindow()
    const only = { left: 0, top: 0, width: 1280, height: 800 }
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({ screens: [only], currentScreen: only }),
    })

    openDisplayWindow()
    await flush()

    expect(display.moves).toEqual([[0, 0]])
    expect(display.resizes).toEqual([[1280, 800]])
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
    const external = { left: 1440, top: 0, width: 1920, height: 1080 }
    stubWindow({
      opened: display,
      getScreenDetails: async () => ({ screens: [external], currentScreen: null }),
    })

    openDisplayWindow()
    display.closed = true
    await flush()

    expect(display.moves).toEqual([])
    expect(display.resizes).toEqual([])
  })

  it('браузер без Window Management API просто открывает окно', async () => {
    stubWindow({ opened: new FakeDisplayWindow() })

    openDisplayWindow()
    await flush()

    expect(calls).toEqual(['open'])
    expect(ui.lastNotice).toBeNull()
  })

  it('попап заблокирован (open === null) — оператор видит уведомление', () => {
    stubWindow({ opened: null, getScreenDetails: async () => ({ screens: [], currentScreen: null }) })

    openDisplayWindow()

    expect(ui.lastNotice).toBeTruthy()
    expect(ui.lastNotice).toContain('всплывающие окна')
    // за разрешением не идём: показывать нечего
    expect(calls).toEqual(['open'])
  })
})
