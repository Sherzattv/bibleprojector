/**
 * Слой данных: переводы Библии и каталоги песен по языкам.
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

import { loadManifest, loadDataFile, type KVStore, type FetchText, type DataManifest } from './cache'
import {
  DEFAULT_SONG_LANG,
  SONG_LANGS,
  isSongLang,
  songLangInfo,
  songLangOf,
  type SongLang,
} from '../songs/languages'
import { createBrowserStore, type TextStore } from '../utils/storage'

export type LoadStatus = 'loading' | 'ready' | 'error'

export const TRANSLATIONS: Array<[code: string, label: string]> = [
  ['RST', 'Синодальный'],
  ['NRT', 'Новый русский'],
  ['KTB', 'Қазақша'],
  ['KYB', 'Кыргызча'],
]

const IS_DEMO = import.meta.env.MODE === 'demo'

/**
 * Выбор оператора переживает перезагрузку: церковь читает и поёт на своём
 * языке, и пульт должен стартовать сразу на нём
 */
const SONG_LANG_KEY = 'bp3-song-lang'
const TRANSLATION_KEY = 'bp3-translation'
const DEFAULT_TRANSLATION = 'RST'

function isTranslation(value: unknown): value is string {
  return TRANSLATIONS.some(([code]) => code === value)
}

/** Песни по базам: каждая в порядке своего файла */
export function groupSongsByLang(songs: readonly SongRow[]): Record<SongLang, SongRow[]> {
  const groups = Object.fromEntries(SONG_LANGS.map((l) => [l.code, [] as SongRow[]])) as Record<
    SongLang,
    SongRow[]
  >
  for (const song of songs) groups[songLangOf(song.id)].push(song)
  return groups
}

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

export class DataStore {
  // $state.raw: данные иммутабельны, глубокие прокси на 43 МБ —
  // лишние CPU и память; реактивность только на замену ссылки
  bibles = $state.raw<Record<string, BibleDb>>({})
  /** Песни всех загруженных языков: порядок служения и история ссылаются на любую */
  songs = $state.raw<SongRow[]>([])
  /** O(1)-доступ к песне: номера не уникальны, id — единственный ключ */
  songsById = $derived(new Map(this.songs.map((s) => [s.id, s])))
  /** Каталог каждого языка отдельно — для списка песен в библиотеке */
  songsByLang = $derived(groupSongsByLang(this.songs))
  /** Язык каталога песен в библиотеке и первый в выдаче поиска */
  songLang = $state<SongLang>(DEFAULT_SONG_LANG)
  /** Статус загрузки базы песен каждого языка */
  songStatus = $state<Partial<Record<SongLang, LoadStatus>>>({})
  translation = $state(DEFAULT_TRANSLATION)
  status = $state<LoadStatus>('loading')
  /** Статус фоновой загрузки по каждому переводу */
  translationStatus = $state<Record<string, LoadStatus>>({})
  demo = IS_DEMO

  get db(): BibleDb | null {
    return this.bibles[this.translation] ?? null
  }

  private kv: KVStore = createKV()
  private manifest: DataManifest = { version: '', files: {} }
  private prefs: TextStore

  /** prefs — где лежит выбор оператора; тесты подставляют своё хранилище */
  constructor(prefs: TextStore = createBrowserStore()) {
    this.prefs = prefs
    const lang = prefs.get(SONG_LANG_KEY)
    if (isSongLang(lang)) this.songLang = lang
    const translation = prefs.get(TRANSLATION_KEY)
    if (isTranslation(translation)) this.translation = translation
  }

  /** Сменить перевод Библии (запоминается). Перевод должен быть загружен */
  selectTranslation(code: string): void {
    this.translation = code
    this.prefs.set(TRANSLATION_KEY, code)
  }

  /** Сменить язык каталога песен (запоминается) */
  setSongLang(lang: SongLang): void {
    this.songLang = lang
    this.prefs.set(SONG_LANG_KEY, lang)
  }

  private setSongStatus(lang: SongLang, status: LoadStatus): void {
    this.songStatus = { ...this.songStatus, [lang]: status }
  }

  private setTranslationStatus(code: string, status: LoadStatus): void {
    this.translationStatus = { ...this.translationStatus, [code]: status }
  }

  private loadFile(name: string): Promise<unknown> {
    return loadDataFile(name, `data/${name}`, this.manifest, this.kv, fetchText)
  }

  /** Положить базу языка в общий каталог, заменив прежнюю версию этой базы */
  private setSongBase(lang: SongLang, rows: SongRow[]): void {
    const others = this.songs.filter((s) => songLangOf(s.id) !== lang)
    // Чужие id в файле языка — испорченный или подменённый файл: такие
    // песни перепутались бы с песнями другой базы в порядке служения
    const own = rows.filter((s) => songLangOf(s.id) === lang)
    this.songs = lang === DEFAULT_SONG_LANG ? [...own, ...others] : [...others, ...own]
  }

  private async fetchSongs(lang: SongLang): Promise<SongRow[]> {
    const rows = await this.loadFile(songLangInfo(lang).file)
    if (!Array.isArray(rows)) throw new Error(`Песни ${lang}: ожидался массив`)
    return rows as SongRow[]
  }

  /** Фоновая база песен: ошибка остаётся в songStatus и не роняет пульт */
  private async loadSongs(lang: SongLang): Promise<void> {
    this.setSongStatus(lang, 'loading')
    try {
      this.setSongBase(lang, await this.fetchSongs(lang))
      this.setSongStatus(lang, 'ready')
    } catch (e) {
      console.error(`Songs ${lang} failed to load`, e)
      this.setSongStatus(lang, 'error')
    }
  }

  /** Повторить загрузку базы песен после ошибки */
  retrySongs(lang: SongLang): Promise<void> {
    return this.loadSongs(lang)
  }

  private async fetchBible(code: string): Promise<BibleDb> {
    return (await this.loadFile(`${code.toLowerCase()}.json`)) as BibleDb
  }

  /** Фоновый перевод: ошибка остаётся в translationStatus и не роняет пульт */
  private async loadTranslation(code: string): Promise<void> {
    this.setTranslationStatus(code, 'loading')
    try {
      const db = await this.fetchBible(code)
      this.bibles = { ...this.bibles, [code]: db }
      this.setTranslationStatus(code, 'ready')
    } catch (e) {
      console.error(`Translation ${code} failed to load`, e)
      this.setTranslationStatus(code, 'error')
    }
  }

  /**
   * Стартовый перевод — тот, на котором оператор закончил. Не загрузился —
   * старт идёт на RST (выбор при этом не стирается: в следующий раз пульт
   * попробует снова), а сам перевод ещё раз пробует фоновая загрузка
   */
  private async loadStartTranslation(code: string): Promise<[string, BibleDb]> {
    try {
      return [code, await this.fetchBible(code)]
    } catch (e) {
      if (code === DEFAULT_TRANSLATION) throw e
      console.error(`Translation ${code} failed to load at start, falling back to RST`, e)
      return [DEFAULT_TRANSLATION, await this.fetchBible(DEFAULT_TRANSLATION)]
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
        const demo = (await import('../demo-data.json')) as unknown as {
          default: {
            translations: Record<string, BibleDb>
            songs: Partial<Record<SongLang, SongRow[]>>
          }
        }
        this.bibles = demo.default.translations
        this.songs = SONG_LANGS.flatMap((l) => demo.default.songs[l.code] ?? [])
        this.translationStatus = Object.fromEntries(
          Object.keys(this.bibles).map((code) => [code, 'ready']),
        )
        this.songStatus = Object.fromEntries(SONG_LANGS.map((l) => [l.code, 'ready']))
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
        // Базы песен других языков едут параллельно со стартовой парой. Их
        // ждём до готовности (небольшие, ~1 МБ): иначе порядок служения с
        // казахской песней первым пунктом не открылся бы на старте. Ошибка
        // такой базы старт не роняет — она видна в songStatus
        const extraSongs = SONG_LANGS.filter((l) => l.code !== DEFAULT_SONG_LANG).map((l) =>
          this.loadSongs(l.code),
        )
        this.setSongStatus(DEFAULT_SONG_LANG, 'loading')
        const start = isTranslation(this.translation) ? this.translation : DEFAULT_TRANSLATION
        const [[code, bible], songs] = await Promise.all([
          this.loadStartTranslation(start),
          this.fetchSongs(DEFAULT_SONG_LANG),
        ])
        this.bibles = { [code]: bible }
        this.translation = code
        this.setSongBase(DEFAULT_SONG_LANG, songs)
        this.setSongStatus(DEFAULT_SONG_LANG, 'ready')
        this.setTranslationStatus(code, 'ready')
        await Promise.all(extraSongs)
        // Остальные переводы — в фоне, не блокируя старт;
        // ошибки фиксируются в translationStatus, не роняя процесс
        for (const [other] of TRANSLATIONS) {
          if (other === code) continue
          void this.loadTranslation(other)
        }
      }
      this.status = 'ready'
    } catch (e) {
      console.error('Data load failed', e)
      this.status = 'error'
      if (this.songStatus[DEFAULT_SONG_LANG] === 'loading') {
        this.setSongStatus(DEFAULT_SONG_LANG, 'error')
      }
    }
  }
}

export const data = new DataStore()
