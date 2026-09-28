/**
 * Слой данных: переводы Библии и каталог песен.
 * Полная версия грузит JSON из /data/ (ленивая загрузка переводов),
 * демо-сборка (--mode demo) несёт срез данных внутри бандла.
 */

export interface VerseRow {
  VerseId: number
  Text: string
}
export interface ChapterRow {
  ChapterId: number
  Verses: VerseRow[]
}
export interface BookRow {
  BookId: number
  BookName?: string
  Chapters: ChapterRow[]
}
export interface BibleDb {
  Translation: string
  Books: BookRow[]
}
export interface SongRow {
  id: number
  title: string
  text: string
  songNumber?: string
  alternateTitle?: string
  theme?: string
  copyright?: string
}

import { loadManifest, loadDataFile, type KVStore, type FetchText, type DataManifest } from './data-cache'

export type LoadStatus = 'loading' | 'ready' | 'error'

export const TRANSLATIONS: Array<[code: string, label: string]> = [
  ['RST', 'Синодальный'],
  ['NRT', 'Новый русский'],
  ['KTB', 'Қазақша'],
  ['KYB', 'Кыргызча'],
]

const IS_DEMO = import.meta.env.MODE === 'demo'

/**
 * KV поверх Cache Storage (переживает перезапуски — офлайн-старт);
 * вне браузера / без caches — эфемерная Map (тесты, file://).
 */
function createKV(): KVStore {
  if (typeof caches === 'undefined') {
    const mem = new Map<string, string>()
    return {
      get: async (k) => mem.get(k) ?? null,
      set: async (k, v) => {
        mem.set(k, v)
      },
      delete: async (k) => {
        mem.delete(k)
      },
    }
  }
  const CACHE_NAME = 'bp3-data-v1'
  const keyUrl = (k: string) => `/__bp3-data/${encodeURIComponent(k)}`
  // caches.open умеет бросать (SecurityError в приватном окне Firefox,
  // отозванное хранилище): тогда кэша просто нет, данные едут из сети
  const open = async (): Promise<Cache | null> => {
    try {
      return await caches.open(CACHE_NAME)
    } catch {
      return null
    }
  }
  return {
    async get(k) {
      const cache = await open()
      const hit = await cache?.match(keyUrl(k))
      return hit ? hit.text() : null
    },
    async set(k, v) {
      const cache = await open()
      await cache?.put(keyUrl(k), new Response(v))
    },
    async delete(k) {
      const cache = await open()
      await cache?.delete(keyUrl(k))
    },
  }
}

/**
 * Стартовая пара rst+songs — это ~21 МБ JSON (~5.5 МБ сжатыми), на медленном
 * мобильном канале это под минуту. Берём с двойным запасом: подождать долго
 * лучше, чем висеть вечно — без AbortSignal промис зависшего соединения не
 * разрешается никогда, и пользователь смотрит на бесконечный спиннер.
 */
const FETCH_TIMEOUT_MS = 120_000

/** timeoutMs — только ради тестов; приложение использует FETCH_TIMEOUT_MS */
export function createFetchText(timeoutMs: number = FETCH_TIMEOUT_MS): FetchText {
  return async (url) => {
    // AbortSignal.timeout есть не во всех webview — без него просто без таймаута
    const signal =
      typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
        ? AbortSignal.timeout(timeoutMs)
        : undefined
    const r = await fetch(url, { signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`)
    // Отсутствующий путь на Cloudflare отдаётся как 200 + лендинг: HTML нельзя
    // принимать за данные. headers нет у тестовых моков — там проверку пропускаем
    const type = r.headers?.get('content-type') ?? ''
    if (type && !type.includes('json')) {
      throw new Error(`Ожидался JSON, получен «${type}»: ${url}`)
    }
    // Совместимость с тестовыми моками, отдающими только json()
    return typeof r.text === 'function' ? r.text() : JSON.stringify(await r.json())
  }
}

const fetchText = createFetchText()

class DataStore {
  // $state.raw: данные иммутабельны, глубокие прокси на 43 МБ —
  // лишние CPU и память; реактивность только на замену ссылки
  bibles = $state.raw<Record<string, BibleDb>>({})
  songs = $state.raw<SongRow[]>([])
  /** O(1)-доступ к песне: номера не уникальны, id — единственный ключ */
  songsById = $derived(new Map(this.songs.map((s) => [s.id, s])))
  translation = $state('RST')
  status = $state<LoadStatus>('loading')
  /** Статус фоновой загрузки по каждому переводу */
  translationStatus = $state<Record<string, LoadStatus>>({})
  demo = IS_DEMO

  get db(): BibleDb | null {
    return this.bibles[this.translation] ?? null
  }

  private kv: KVStore = createKV()
  private manifest: DataManifest = { version: '', files: {} }

  private loadFile(name: string): Promise<unknown> {
    return loadDataFile(name, `data/${name}`, this.manifest, this.kv, fetchText)
  }

  private async loadTranslation(code: string): Promise<void> {
    this.translationStatus = { ...this.translationStatus, [code]: 'loading' }
    try {
      const db = (await this.loadFile(`${code.toLowerCase()}.json`)) as BibleDb
      this.bibles = { ...this.bibles, [code]: db }
      this.translationStatus = { ...this.translationStatus, [code]: 'ready' }
    } catch (e) {
      console.error(`Translation ${code} failed to load`, e)
      this.translationStatus = { ...this.translationStatus, [code]: 'error' }
    }
  }

  /** Повторить загрузку перевода после ошибки */
  retryTranslation(code: string): Promise<void> {
    return this.loadTranslation(code)
  }

  /** Повторить стартовую загрузку после ошибки (кнопка «Повторить» в UI) */
  retryInit(): Promise<void> {
    // init() выставляет только ready/error — обратно в loading переводим здесь,
    // чтобы спиннер появился сразу по клику
    this.status = 'loading'
    return this.init()
  }

  async init() {
    try {
      if (IS_DEMO) {
        const demo = (await import('./demo-data.json')) as unknown as {
          default: { translations: Record<string, BibleDb>; songs: SongRow[] }
        }
        this.bibles = demo.default.translations
        this.songs = demo.default.songs
        this.translationStatus = Object.fromEntries(
          Object.keys(this.bibles).map((code) => [code, 'ready']),
        )
      } else {
        // Свежий KV на каждый init: Cache Storage персистентен сам по себе,
        // а in-memory-фоллбек не должен протекать между вызовами
        this.kv = createKV()
        try {
          this.manifest = (await loadManifest('data/manifest.json', this.kv, fetchText)).manifest
        } catch {
          // Нет ни сети, ни кэшированного манифеста — грузим файлы напрямую
          this.manifest = { version: '', files: {} }
        }
        const [rst, songs] = await Promise.all([
          this.loadFile('rst.json') as Promise<BibleDb>,
          this.loadFile('songs.json') as Promise<SongRow[]>,
        ])
        this.bibles = { RST: rst }
        this.songs = songs
        this.translationStatus = { ...this.translationStatus, RST: 'ready' }
        // Остальные переводы — в фоне, не блокируя старт;
        // ошибки фиксируются в translationStatus, не роняя процесс
        for (const [code] of TRANSLATIONS) {
          if (code === 'RST') continue
          void this.loadTranslation(code)
        }
      }
      this.status = 'ready'
    } catch (e) {
      console.error('Data load failed', e)
      this.status = 'error'
    }
  }
}

export const data = new DataStore()
