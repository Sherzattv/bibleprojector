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
  status = $state<'loading' | 'ready' | 'error'>('loading')
  demo = IS_DEMO

  get db(): BibleDb | null {
    return this.bibles[this.translation] ?? null
  }

  async init() {
    try {
      if (IS_DEMO) {
        const demo = (await import('./demo-data.json')) as unknown as {
          default: { translations: Record<string, BibleDb>; songs: SongRow[] }
        }
        this.bibles = demo.default.translations
        this.songs = demo.default.songs
      } else {
        const [rst, songs] = await Promise.all([
          fetch('data/rst.json').then((r) => r.json()),
          fetch('data/songs.json').then((r) => r.json()),
        ])
        this.bibles = { RST: rst }
        this.songs = songs
        // Остальные переводы — в фоне, не блокируя старт
        for (const [code] of TRANSLATIONS) {
          if (code === 'RST') continue
          fetch(`data/${code.toLowerCase()}.json`)
            .then((r) => r.json())
            .then((db) => (this.bibles = { ...this.bibles, [code]: db }))
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
