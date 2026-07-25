/**
 * Состояние «шоу»: текущий элемент (песня или глава Библии),
 * слайды, превью/эфир. Сюда же позже подключится BroadcastChannel
 * окна проектора.
 */
// @ts-expect-error legacy JS module without types
import { splitSongSections } from './legacy/songs.js'
// @ts-expect-error legacy JS module without types
import { getBookId, getBookTitle } from './legacy/canonical.js'
import { data } from './db.svelte'
import type { SongRow } from './db.svelte'

export interface ShowSlide {
  label: string
  text: string
  reference: string
}

interface VerseContext {
  canonicalCode: string
  chapter: number
}

class ShowState {
  title = $state('')
  subtitle = $state('')
  kind = $state<'song' | 'bible' | null>(null)
  slides = $state<ShowSlide[]>([])
  previewIdx = $state(0)
  liveIdx = $state(-1)
  blackout = $state(false)
  /** Контекст главы для смены перевода */
  verseCtx: VerseContext | null = null

  get previewSlide(): ShowSlide | null {
    return this.slides[this.previewIdx] ?? null
  }
  get liveSlide(): ShowSlide | null {
    return this.slides[this.liveIdx] ?? null
  }

  loadSong(song: SongRow) {
    const sections = splitSongSections(song.text) as Array<{
      label: string
      rawText: string
    }>
    const base = song.songNumber ? `${song.title} · № ${song.songNumber}` : song.title
    this.kind = 'song'
    this.verseCtx = null
    this.title = song.title
    this.subtitle = song.songNumber ? `№ ${song.songNumber}` : ''
    this.slides = sections.map((s, i) => ({
      label: s.label || `Строфа ${i + 1}`,
      text: s.rawText.replace(/^\[[^\]]+\]\n?/, ''),
      reference: s.label ? `${base} · ${s.label}` : base,
    }))
    this.previewIdx = 0
    this.liveIdx = -1
  }

  /** Загрузить главу; previewVerse — какой стих поставить в превью */
  loadChapter(canonicalCode: string, chapter: number, previewVerse = 1): boolean {
    const db = data.db
    if (!db) return false
    const translation = data.translation
    const bookId = getBookId(canonicalCode, translation)
    const book = db.Books.find((b) => b.BookId === bookId)
    const chap = book?.Chapters.find((c) => c.ChapterId === chapter)
    if (!chap) return false

    const lang = translation === 'KTB' ? 'kz' : translation === 'KYB' ? 'ky' : 'ru'
    const title = getBookTitle(canonicalCode, lang) as string

    this.kind = 'bible'
    this.verseCtx = { canonicalCode, chapter }
    this.title = `${title} ${chapter}`
    this.subtitle = translation
    this.slides = chap.Verses.map((v) => ({
      label: `Стих ${v.VerseId}`,
      text: v.Text.replace(/<[^>]*>/g, ''),
      reference: `${title} ${chapter}:${v.VerseId}`,
    }))
    const idx = chap.Verses.findIndex((v) => v.VerseId === previewVerse)
    this.previewIdx = idx >= 0 ? idx : 0
    this.liveIdx = -1
    return true
  }

  /** Перезагрузить текущую главу после смены перевода */
  reloadForTranslation() {
    if (this.kind !== 'bible' || !this.verseCtx) return
    const verse = this.previewSlide
      ? parseInt(this.previewSlide.reference.split(':').pop() || '1')
      : 1
    const wasLive = this.liveIdx
    this.loadChapter(this.verseCtx.canonicalCode, this.verseCtx.chapter, verse)
    if (wasLive >= 0) this.liveIdx = Math.min(wasLive, this.slides.length - 1)
  }

  setPreview(i: number) {
    if (i >= 0 && i < this.slides.length) this.previewIdx = i
  }
  next() {
    this.setPreview(this.previewIdx + 1)
  }
  prev() {
    this.setPreview(this.previewIdx - 1)
  }

  go() {
    if (!this.slides.length) return
    this.liveIdx = this.previewIdx
    if (this.previewIdx < this.slides.length - 1) this.previewIdx++
  }

  takeLive(i: number) {
    this.previewIdx = i
    this.go()
  }

  toggleBlackout() {
    this.blackout = !this.blackout
  }

  clear() {
    this.liveIdx = -1
  }
}

export const show = new ShowState()
