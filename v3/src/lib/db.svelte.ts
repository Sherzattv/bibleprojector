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

export type LoadStatus = 'loading' | 'ready' | 'error'

export const TRANSLATIONS: Array<[code: string, label: string]> = [
  ['RST', 'Синодальный'],
  ['NRT', 'Новый русский'],
  ['KTB', 'Қазақша'],
  ['KYB', 'Кыргызча'],
]

const IS_DEMO = import.meta.env.MODE === 'demo'

class DataStore {
  bibles = $state<Record<string, BibleDb>>({})
  songs = $state<SongRow[]>([])
  translation = $state('RST')
  status = $state<LoadStatus>('loading')
  /** Статус фоновой загрузки по каждому переводу */
  translationStatus = $state<Record<string, LoadStatus>>({})
  demo = IS_DEMO

  get db(): BibleDb | null {
    return this.bibles[this.translation] ?? null
  }

  private async fetchJson(path: string): Promise<unknown> {
    const r = await fetch(path)
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${path}`)
    return r.json()
  }

  private async loadTranslation(code: string): Promise<void> {
    this.translationStatus = { ...this.translationStatus, [code]: 'loading' }
    try {
      const db = (await this.fetchJson(`data/${code.toLowerCase()}.json`)) as BibleDb
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
        const [rst, songs] = await Promise.all([
          this.fetchJson('data/rst.json') as Promise<BibleDb>,
          this.fetchJson('data/songs.json') as Promise<SongRow[]>,
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
