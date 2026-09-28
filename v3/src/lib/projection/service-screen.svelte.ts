/**
 * Служебные экраны: отсчёт до начала служения и экран ожидания с
 * названием общины и объявлениями. Пока служебный экран включён, он
 * перекрывает слайды в эфире; GO и «Очистить» его убирают.
 *
 * Отсчёт едет на экран моментом окончания (endsAt), а не секундами: экран
 * тикает сам по своим часам, и пропущенное сообщение не сбивает время.
 * Пульт и экран живут на одной машине — часы у них общие.
 *
 * Тексты и длительность хранятся, сам режим — нет: после перезапуска
 * служебный экран выключен.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from '../utils/storage'
import type { ServiceContent } from './content'

const KEY = 'bp3-service-screen'

export type ServiceMode = 'off' | 'countdown' | 'welcome'

export const COUNTDOWN_MINUTES = [1, 2, 3, 5, 10, 15, 20, 30] as const

const DEFAULTS = {
  minutes: 5,
  title: 'Служение начнётся через',
  subtitle: 'Добро пожаловать! Располагайтесь, скоро начнём',
  churchName: 'Наша церковь',
  announcements: [
    'Добро пожаловать! Рады видеть вас на служении',
    'Пожалуйста, переведите телефон в беззвучный режим',
  ],
}

/** Сколько символов текста служебного экрана принимаем — защита от вставки романа */
const TEXT_MAX = 200
const ANNOUNCEMENTS_MAX = 20

/** 04:59; остаток округляется вверх — «00:00» только когда время вышло */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Остаток отсчёта на момент now */
export function countdownLeft(c: { endsAt: number | null; leftMs: number }, now: number): number {
  return c.endsAt === null ? Math.max(0, c.leftMs) : Math.max(0, c.endsAt - now)
}

function cleanText(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v.slice(0, TEXT_MAX) : fallback
}

/** Объявления: по одному на строку, пустые выбрасываются */
export function parseAnnouncements(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim().slice(0, TEXT_MAX))
    .filter(Boolean)
    .slice(0, ANNOUNCEMENTS_MAX)
}

export class ServiceScreenStore {
  mode = $state<ServiceMode>('off')
  minutes = $state(DEFAULTS.minutes)
  /** Момент окончания отсчёта (epoch ms); null — отсчёт стоит */
  endsAt = $state<number | null>(null)
  /** Остаток, пока отсчёт стоит */
  leftMs = $state(DEFAULTS.minutes * 60_000)
  title = $state(DEFAULTS.title)
  subtitle = $state(DEFAULTS.subtitle)
  churchName = $state(DEFAULTS.churchName)
  announcements = $state<string[]>([...DEFAULTS.announcements])

  private store: TextStore
  private now: () => number

  constructor(store: TextStore = createBrowserStore(), now: () => number = () => Date.now()) {
    this.store = store
    this.now = now
    this.load()
  }

  private load() {
    this.mode = 'off'
    this.endsAt = null
    let r: Record<string, unknown> = {}
    try {
      const raw = this.store.get(KEY)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (parsed && typeof parsed === 'object') r = parsed as Record<string, unknown>
    } catch {
      // повреждённое хранилище — остаёмся на дефолтах
    }
    this.minutes = COUNTDOWN_MINUTES.includes(r.minutes as (typeof COUNTDOWN_MINUTES)[number])
      ? (r.minutes as number)
      : DEFAULTS.minutes
    this.leftMs = this.minutes * 60_000
    this.title = cleanText(r.title, DEFAULTS.title)
    this.subtitle = cleanText(r.subtitle, DEFAULTS.subtitle)
    this.churchName = cleanText(r.churchName, DEFAULTS.churchName)
    this.announcements = Array.isArray(r.announcements)
      ? parseAnnouncements(r.announcements.filter((a) => typeof a === 'string').join('\n'))
      : [...DEFAULTS.announcements]
  }

  private persist() {
    this.store.set(
      KEY,
      JSON.stringify({
        minutes: this.minutes,
        title: this.title,
        subtitle: this.subtitle,
        churchName: this.churchName,
        announcements: this.announcements,
      }),
    )
  }

  show(mode: Exclude<ServiceMode, 'off'>) {
    this.mode = mode
  }

  hide() {
    this.mode = 'off'
  }

  get running(): boolean {
    return this.endsAt !== null
  }

  remaining(): number {
    return countdownLeft(this, this.now())
  }

  setMinutes(m: number) {
    if (!COUNTDOWN_MINUTES.includes(m as (typeof COUNTDOWN_MINUTES)[number])) return
    this.minutes = m
    this.endsAt = null
    this.leftMs = m * 60_000
    this.persist()
  }

  /** Пуск; закончившийся отсчёт начинается заново */
  start() {
    if (this.running) return
    if (this.leftMs <= 0) this.leftMs = this.minutes * 60_000
    this.endsAt = this.now() + this.leftMs
  }

  pause() {
    if (!this.running) return
    this.leftMs = this.remaining()
    this.endsAt = null
  }

  reset() {
    this.endsAt = null
    this.leftMs = this.minutes * 60_000
  }

  setTexts(patch: { title?: string; subtitle?: string; churchName?: string }) {
    if (patch.title !== undefined) this.title = cleanText(patch.title, this.title)
    if (patch.subtitle !== undefined) this.subtitle = cleanText(patch.subtitle, this.subtitle)
    if (patch.churchName !== undefined)
      this.churchName = cleanText(patch.churchName, this.churchName)
    this.persist()
  }

  setAnnouncements(text: string) {
    this.announcements = parseAnnouncements(text)
    this.persist()
  }

  /** Что уезжает на экран; null — служебный экран выключен */
  content(): ServiceContent | null {
    if (this.mode === 'countdown') {
      return {
        kind: 'countdown',
        endsAt: this.endsAt,
        leftMs: this.leftMs,
        title: this.title,
        subtitle: this.subtitle,
      }
    }
    if (this.mode === 'welcome') {
      return { kind: 'welcome', name: this.churchName, announcements: [...this.announcements] }
    }
    return null
  }

  /** Для тестов: подменить хранилище и часы */
  resetStore(store: TextStore = createMemoryStore(), now: () => number = () => Date.now()) {
    this.store = store
    this.now = now
    this.load()
  }
}

export const serviceScreen = new ServiceScreenStore()
