import { describe, it, expect, beforeEach } from 'vitest'
import {
  ServiceScreenStore,
  countdownLeft,
  formatCountdown,
  parseAnnouncements,
} from '../../src/lib/projection/service-screen.svelte'
import { createMemoryStore, type TextStore } from '../../src/lib/utils/storage'

describe('formatCountdown', () => {
  it('минуты и секунды с ведущими нулями', () => {
    expect(formatCountdown(5 * 60_000)).toBe('05:00')
    expect(formatCountdown(65_000)).toBe('01:05')
  })

  it('остаток округляется вверх: 00:00 — только когда время вышло', () => {
    expect(formatCountdown(200)).toBe('00:01')
    expect(formatCountdown(0)).toBe('00:00')
    expect(formatCountdown(-5000)).toBe('00:00')
  })
})

describe('countdownLeft', () => {
  it('идущий отсчёт считается от момента окончания', () => {
    expect(countdownLeft({ endsAt: 10_000, leftMs: 999 }, 4_000)).toBe(6_000)
    expect(countdownLeft({ endsAt: 10_000, leftMs: 999 }, 12_000)).toBe(0)
  })

  it('стоящий отсчёт — сохранённый остаток', () => {
    expect(countdownLeft({ endsAt: null, leftMs: 42_000 }, 1e12)).toBe(42_000)
  })
})

describe('parseAnnouncements', () => {
  it('по одному на строку, пустые и пробелы выбрасываются', () => {
    expect(parseAnnouncements('  Чай после служения \n\n Молодёжка в пятницу\n   ')).toEqual([
      'Чай после служения',
      'Молодёжка в пятницу',
    ])
  })

  it('не больше 20 объявлений', () => {
    expect(
      parseAnnouncements(Array.from({ length: 30 }, (_, i) => `№${i}`).join('\n')),
    ).toHaveLength(20)
  })
})

describe('ServiceScreenStore', () => {
  let store: TextStore
  let clock: number
  let s: ServiceScreenStore

  beforeEach(() => {
    store = createMemoryStore()
    clock = 1_000_000
    s = new ServiceScreenStore(store, () => clock)
  })

  it('по умолчанию выключен, отсчёт 5 минут стоит', () => {
    expect(s.mode).toBe('off')
    expect(s.content()).toBeNull()
    expect(s.running).toBe(false)
    expect(s.remaining()).toBe(5 * 60_000)
  })

  it('старт, пауза и продолжение считают время по часам', () => {
    s.start()
    clock += 60_000
    expect(s.remaining()).toBe(4 * 60_000)
    s.pause()
    clock += 10 * 60_000 // на паузе время не идёт
    expect(s.remaining()).toBe(4 * 60_000)
    s.start()
    clock += 30_000
    expect(s.remaining()).toBe(3.5 * 60_000)
  })

  it('отсчёт едет на экран моментом окончания, а не секундами', () => {
    s.show('countdown')
    s.start()
    expect(s.content()).toMatchObject({ kind: 'countdown', endsAt: clock + 5 * 60_000 })
  })

  it('закончившийся отсчёт по старту начинается заново', () => {
    s.setMinutes(1)
    s.start()
    clock += 2 * 60_000
    s.pause()
    expect(s.remaining()).toBe(0)
    s.start()
    expect(s.remaining()).toBe(60_000)
  })

  it('сброс и смена длительности останавливают отсчёт', () => {
    s.start()
    s.setMinutes(10)
    expect(s.running).toBe(false)
    expect(s.remaining()).toBe(10 * 60_000)
    s.start()
    clock += 1000
    s.reset()
    expect(s.running).toBe(false)
    expect(s.remaining()).toBe(10 * 60_000)
  })

  it('чужая длительность игнорируется', () => {
    s.setMinutes(7)
    expect(s.minutes).toBe(5)
  })

  it('экран ожидания — название и объявления', () => {
    s.setTexts({ churchName: 'Благодать' })
    s.setAnnouncements('Чай\nМолодёжка')
    s.show('welcome')
    expect(s.content()).toEqual({
      kind: 'welcome',
      name: 'Благодать',
      announcements: ['Чай', 'Молодёжка'],
    })
  })

  it('тексты и длительность переживают перезапуск, режим и отсчёт — нет', () => {
    s.setMinutes(10)
    s.setTexts({ title: 'Начало через', subtitle: 'Рады вам', churchName: 'Слово' })
    s.setAnnouncements('Одно')
    s.show('countdown')
    s.start()

    const restored = new ServiceScreenStore(store, () => clock)
    expect(restored).toMatchObject({
      mode: 'off',
      minutes: 10,
      title: 'Начало через',
      subtitle: 'Рады вам',
      churchName: 'Слово',
      announcements: ['Одно'],
    })
    expect(restored.running).toBe(false)
  })

  it('мусор в хранилище — дефолты без исключений', () => {
    const broken = createMemoryStore({ 'bp3-service-screen': '{{{ не json' })
    expect(() => new ServiceScreenStore(broken)).not.toThrow()
    const odd = createMemoryStore({
      'bp3-service-screen': JSON.stringify({ minutes: 999, title: 42, announcements: 'строка' }),
    })
    const s2 = new ServiceScreenStore(odd)
    expect(s2.minutes).toBe(5)
    expect(s2.title).toBe('Служение начнётся через')
    expect(s2.announcements.length).toBeGreaterThan(0)
  })

  it('content клонируется structuredClone — его везёт BroadcastChannel', () => {
    s.show('welcome')
    expect(() => structuredClone(s.content())).not.toThrow()
    s.show('countdown')
    expect(() => structuredClone(s.content())).not.toThrow()
  })

  it('длинный текст обрезается до 200 символов', () => {
    s.setTexts({ churchName: 'я'.repeat(500) })
    expect(s.churchName).toHaveLength(200)
  })
})
