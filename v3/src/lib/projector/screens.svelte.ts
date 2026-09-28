/**
 * Мониторы: список экранов, выбор экрана проектора и запоминание выбора.
 *
 * Window Management API (Chrome 100+) отдаёт координаты и label каждого
 * монитора, но первый `getScreenDetails()` показывает запрос разрешения и
 * висит, пока оператор не ответит. Поэтому геометрия выбранного экрана
 * дублируется в localStorage: следующее открытие ставит окно на нужный
 * монитор сразу, не дожидаясь ни разрешения, ни асинхронного ответа API.
 */
import { createBrowserStore, createMemoryStore, type TextStore } from './storage'

const KEY = 'bp3-display-screen'

/** Снимок монитора — то, что переживает перезагрузку пульта */
export interface ScreenInfo {
  /** Ключ для сопоставления с живым списком: label + размер + позиция */
  id: string
  label: string
  left: number
  top: number
  width: number
  height: number
  isPrimary: boolean
  isInternal: boolean
  /** Монитор, на котором сейчас окно пульта */
  isCurrent: boolean
}

/** ScreenDetailed из Window Management API — только используемые поля */
export interface ScreenDetailedLike {
  label?: string
  left: number
  top: number
  width: number
  height: number
  availLeft?: number
  availTop?: number
  availWidth?: number
  availHeight?: number
  isPrimary?: boolean
  isInternal?: boolean
}

export interface ScreenDetailsLike {
  screens: ScreenDetailedLike[]
  currentScreen: unknown
  addEventListener?(type: string, listener: () => void): void
}

export type ScreenPermission = 'unsupported' | 'unknown' | 'prompt' | 'granted' | 'denied'

function num(primary: unknown, fallback: number): number {
  return typeof primary === 'number' && Number.isFinite(primary) ? primary : fallback
}

export function screenIdOf(s: {
  label: string
  left: number
  top: number
  width: number
  height: number
}): string {
  return `${s.label}#${s.width}x${s.height}@${s.left},${s.top}`
}

/**
 * Для размещения окна берём рабочую область (avail*), а не полный прямоугольник:
 * иначе окно уезжает под панель задач и потом «прыгает» при разворачивании.
 */
export function toScreenInfo(s: ScreenDetailedLike, isCurrent: boolean): ScreenInfo {
  const label = typeof s.label === 'string' ? s.label : ''
  const left = num(s.availLeft, s.left)
  const top = num(s.availTop, s.top)
  const width = num(s.availWidth, s.width)
  const height = num(s.availHeight, s.height)
  return {
    id: screenIdOf({ label, left, top, width, height }),
    label,
    left,
    top,
    width,
    height,
    isPrimary: s.isPrimary === true,
    isInternal: s.isInternal === true,
    isCurrent,
  }
}

/** Подпись для списка: у монитора может не быть имени, но размер есть всегда */
export function screenTitle(s: ScreenInfo): string {
  const name = s.label || (s.isInternal ? 'Встроенный дисплей' : 'Монитор')
  return `${name} · ${s.width}×${s.height}`
}

/**
 * Найти сохранённый монитор в живом списке. Оператор мог переставить экраны
 * местами в системе, поэтому одного id мало: пробуем имя и размер, затем
 * позицию — так выбор переживает и переподключение кабеля, и смену раскладки.
 */
export function matchScreen(saved: ScreenInfo | null, list: ScreenInfo[]): ScreenInfo | null {
  if (!saved || !list.length) return null
  const byId = list.find((s) => s.id === saved.id)
  if (byId) return byId
  if (saved.label) {
    const byLabel = list.find(
      (s) => s.label === saved.label && s.width === saved.width && s.height === saved.height,
    )
    if (byLabel) return byLabel
  }
  return list.find((s) => s.left === saved.left && s.top === saved.top) ?? null
}

/**
 * Монитор проектора «по умолчанию»: внешний, не тот, где пульт.
 * Единственный экран не возвращаем — окно на весь экран накрыло бы пульт.
 */
export function autoPickScreen(list: ScreenInfo[]): ScreenInfo | null {
  if (list.length < 2) return null
  return list.find((s) => !s.isCurrent && !s.isInternal) ?? list.find((s) => !s.isCurrent) ?? null
}

function isScreenInfo(v: unknown): v is ScreenInfo {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.label === 'string' &&
    ['left', 'top', 'width', 'height'].every(
      (k) => typeof s[k] === 'number' && Number.isFinite(s[k] as number),
    ) &&
    (s.width as number) > 0 &&
    (s.height as number) > 0
  )
}

export class ScreensStore {
  /** Живой список мониторов; пуст, пока нет разрешения или API */
  list = $state<ScreenInfo[]>([])
  /** Выбор оператора — переживает перезагрузку */
  saved = $state<ScreenInfo | null>(null)
  permission = $state<ScreenPermission>('unknown')

  private store: TextStore
  /** ScreenDetailed по id: нужен для requestFullscreen({ screen }) */
  private raw = new Map<string, ScreenDetailedLike>()
  private watching = false

  constructor(store: TextStore = createBrowserStore()) {
    this.store = store
    this.saved = this.read()
  }

  /** Куда открывать окно: выбранный монитор, иначе автоматический */
  get target(): ScreenInfo | null {
    // Список пуст — разрешения ещё нет; верим сохранённой геометрии,
    // иначе первое открытие всегда попадало бы на экран пульта.
    if (!this.list.length) return this.saved
    return matchScreen(this.saved, this.list) ?? autoPickScreen(this.list)
  }

  /** Сырой ScreenDetailed выбранного экрана — для requestFullscreen({ screen }) */
  rawFor(info: ScreenInfo | null): ScreenDetailedLike | null {
    return info ? (this.raw.get(info.id) ?? null) : null
  }

  select(info: ScreenInfo | null): void {
    this.saved = info
    if (info) this.store.set(KEY, JSON.stringify(info))
    else this.store.remove(KEY)
  }

  /**
   * Перечитать мониторы. Без `prompt` разрешение не запрашивается: на старте
   * пульта окно запроса было бы навязчивым и съело бы transient activation.
   */
  async refresh(opts: { prompt?: boolean } = {}): Promise<ScreenInfo[]> {
    const w = globalThis.window as
      | (Window & { getScreenDetails?: () => Promise<ScreenDetailsLike> })
      | undefined
    if (typeof w?.getScreenDetails !== 'function') {
      this.permission = 'unsupported'
      return []
    }
    if (!opts.prompt && !(await this.isGranted())) return []
    try {
      const details = await w.getScreenDetails()
      this.apply(details)
      this.permission = 'granted'
      this.watch(details)
      return this.list
    } catch {
      // Оператор отказал или окно закрыли — работаем без размещения по мониторам
      this.permission = 'denied'
      return []
    }
  }

  /** Для тестов: подменить хранилище (без аргумента — чистое in-memory) */
  reset(store: TextStore = createMemoryStore()): void {
    this.store = store
    this.list = []
    this.raw.clear()
    this.watching = false
    this.permission = 'unknown'
    this.saved = this.read()
  }

  private async isGranted(): Promise<boolean> {
    const perms = (globalThis.navigator as Navigator | undefined)?.permissions
    if (typeof perms?.query !== 'function') {
      this.permission = 'unknown'
      return false
    }
    try {
      const status = await perms.query({ name: 'window-management' as PermissionName })
      this.permission = status.state as ScreenPermission
      return status.state === 'granted'
    } catch {
      // Браузер не знает такого разрешения — только явный запрос покажет правду
      this.permission = 'unknown'
      return false
    }
  }

  private apply(details: ScreenDetailsLike): void {
    const screens = Array.isArray(details.screens) ? details.screens : []
    const list = screens.map((s) => toScreenInfo(s, s === details.currentScreen))
    this.raw.clear()
    list.forEach((info, i) => this.raw.set(info.id, screens[i]))
    this.list = list
    // Монитор мог переехать в раскладке — держим сохранённую геометрию актуальной
    const matched = matchScreen(this.saved, list)
    if (matched && matched.id !== this.saved?.id) this.select(matched)
  }

  private watch(details: ScreenDetailsLike): void {
    if (this.watching || typeof details.addEventListener !== 'function') return
    this.watching = true
    // Проектор подключили/отключили — список и сохранённая геометрия устарели
    details.addEventListener('screenschange', () => {
      void this.refresh({ prompt: true })
    })
  }

  private read(): ScreenInfo | null {
    try {
      const raw = this.store.get(KEY)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (!isScreenInfo(parsed)) return null
      return {
        ...parsed,
        isPrimary: parsed.isPrimary === true,
        isInternal: parsed.isInternal === true,
        isCurrent: false,
      }
    } catch {
      // Повреждённое хранилище — просто нет запомненного монитора
      return null
    }
  }
}
