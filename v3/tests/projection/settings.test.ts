import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProjSettingsStore } from '../../src/lib/projection/settings.svelte'
import type { TextStore } from '../../src/lib/show/edits.svelte'

/** Фейковое хранилище: Map-обёртка под интерфейс TextStore */
function makeFakeStore(): TextStore {
  const map = new Map<string, string>()
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      map.set(k, v)
    },
    remove: (k) => {
      map.delete(k)
    },
  }
}

describe('ProjSettingsStore', () => {
  let store: TextStore
  let settings: ProjSettingsStore

  beforeEach(() => {
    store = makeFakeStore()
    settings = new ProjSettingsStore(store)
  })

  it('дефолты: масштаб 1, ссылка показывается', () => {
    expect(settings.fontScale).toBe(1)
    expect(settings.showReference).toBe(true)
  })

  it('setFontScale клампит сверху: 3 → 2', () => {
    settings.setFontScale(3)
    expect(settings.fontScale).toBe(2)
  })

  it('setFontScale клампит снизу: 0.1 → 0.5', () => {
    settings.setFontScale(0.1)
    expect(settings.fontScale).toBe(0.5)
  })

  it('setFontScale в пределах диапазона сохраняет значение как есть', () => {
    settings.setFontScale(1.3)
    expect(settings.fontScale).toBe(1.3)
  })

  it('setShowReference переключает флаг', () => {
    settings.setShowReference(false)
    expect(settings.showReference).toBe(false)
    settings.setShowReference(true)
    expect(settings.showReference).toBe(true)
  })

  it('персистентность: новый экземпляр над тем же store восстанавливает настройки', () => {
    settings.setFontScale(1.7)
    settings.setShowReference(false)

    const restored = new ProjSettingsStore(store)
    expect(restored.fontScale).toBe(1.7)
    expect(restored.showReference).toBe(false)
  })

  it('повреждённые значения в store → дефолты, без исключений', () => {
    // не угадываем имена ключей: любой get отдаёт мусорную строку
    const garbage: TextStore = {
      get: () => 'мусор {{{ not-json ]]]',
      set: () => {},
      remove: () => {},
    }

    let broken!: ProjSettingsStore
    expect(() => {
      broken = new ProjSettingsStore(garbage)
    }).not.toThrow()
    expect(broken.fontScale).toBe(1)
    expect(broken.showReference).toBe(true)
  })

  it('дефолты фона: чёрный экран, тень под текстом включена', () => {
    expect(settings.background.preset).toBe('black')
    expect(settings.textShadow).toBe(true)
  })

  it('selectBackground ставит фон вместе с его родной палитрой', () => {
    settings.selectBackground('candles')
    expect(settings.background.preset).toBe('candles')
    expect(settings.background.palette).toBe('amber')
  })

  it('setBackground меняет только переданное и клампит мусор', () => {
    settings.selectBackground('glass')
    settings.setBackground({ dim: 5 })
    expect(settings.background.preset).toBe('glass')
    expect(settings.background.dim).toBe(0.8)
  })

  it('фон и тень переживают перезапуск', () => {
    settings.selectBackground('aurora')
    settings.setBackground({ palette: 'olive', speed: 0.5 })
    settings.setTextShadow(false)

    const restored = new ProjSettingsStore(store)
    expect(restored.background).toMatchObject({ preset: 'aurora', palette: 'olive', speed: 0.5 })
    expect(restored.textShadow).toBe(false)
  })

  it('старый формат без фона (3.1.0) читается: фон по умолчанию, масштаб сохранён', () => {
    store.set('bp3-proj-settings', JSON.stringify({ fontScale: 1.4, showReference: false }))
    const migrated = new ProjSettingsStore(store)
    expect(migrated.fontScale).toBe(1.4)
    expect(migrated.showReference).toBe(false)
    expect(migrated.background.preset).toBe('black')
    expect(migrated.textShadow).toBe(true)
  })

  it('setText меняет шрифт, переход и подсветку, мусор клампится, всё сохраняется', () => {
    settings.setText({
      fontFamily: 'sans',
      transition: 'blur',
      transitionMs: 5000,
      lineHighlight: true,
    })
    expect(settings.transitionMs).toBe(1600)
    const restored = new ProjSettingsStore(store)
    expect(restored).toMatchObject({
      fontFamily: 'sans',
      transition: 'blur',
      transitionMs: 1600,
      lineHighlight: true,
    })
  })

  it('setOutput переключает нижнюю треть и хромакей, это сохраняется', () => {
    settings.setOutput({ layout: 'lower-third', chroma: 'transparent' })
    const restored = new ProjSettingsStore(store)
    expect(restored.layout).toBe('lower-third')
    expect(restored.chroma).toBe('transparent')
  })

  it('snapshot клонируется structuredClone — иначе BroadcastChannel молча не отправит ничего', () => {
    settings.selectBackground('glass')
    expect(() => structuredClone(settings.snapshot())).not.toThrow()
  })

  it('snapshot — всё, что едет на экран, и это копия, а не живое состояние', () => {
    const snap = settings.snapshot()
    expect(Object.keys(snap).sort()).toEqual(
      [
        'background',
        'fontFamily',
        'chroma',
        'fontScale',
        'layout',
        'lineHighlight',
        'media',
        'parallelLayout',
        'secondaryTranslation',
        'showReference',
        'textShadow',
        'transition',
        'transitionMs',
      ].sort(),
    )
    snap.background.dim = 0.7
    expect(settings.background.dim).not.toBe(0.7)
  })

  it('reset() без аргумента даёт чистое in-memory состояние', () => {
    settings.setFontScale(1.9)
    settings.setShowReference(false)

    settings.reset()
    expect(settings.fontScale).toBe(1)
    expect(settings.showReference).toBe(true)
  })
})

/**
 * Safari в приватном режиме, «блокировать все cookies», политика организации —
 * localStorage существует, но бросает на любой вызов.
 */
describe('ProjSettingsStore поверх бросающего localStorage', () => {
  beforeEach(() => {
    const throwing = {
      getItem: () => {
        throw new DOMException('SecurityError')
      },
      setItem: () => {
        throw new DOMException('QuotaExceededError')
      },
      removeItem: () => {
        throw new DOMException('SecurityError')
      },
    }
    vi.stubGlobal('localStorage', throwing)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('конструктор по умолчанию не бросает и даёт дефолты', () => {
    let store!: ProjSettingsStore
    expect(() => {
      store = new ProjSettingsStore()
    }).not.toThrow()
    expect(store.fontScale).toBe(1)
    expect(store.showReference).toBe(true)
  })

  it('setFontScale не бросает (ползунок масштаба в oninput) и меняет состояние', () => {
    const store = new ProjSettingsStore()
    expect(() => store.setFontScale(1.4)).not.toThrow()
    expect(store.fontScale).toBe(1.4)
  })

  it('setShowReference не бросает', () => {
    const store = new ProjSettingsStore()
    expect(() => store.setShowReference(false)).not.toThrow()
    expect(store.showReference).toBe(false)
  })
})
