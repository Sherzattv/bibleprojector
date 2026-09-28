/**
 * Состояние «шоу»: текущий элемент (песня или глава Библии),
 * слайды и Preview/Live. Проекционный DTO строится отдельно и передаётся
 * окну проектора через ProjectorLink.
 */
import { splitSongSections } from './legacy/songs.js'
import { getBookId, getBookTitle } from './legacy/canonical.js'
import { data } from './db.svelte'
import { edits } from './edits.svelte'
import type { SongRow } from './db.svelte'
import { singableLines } from './projection'
import type { PaletteId } from './backgrounds/catalog'

export type ShowSource =
  | { kind: 'song'; id: number }
  | { kind: 'bible'; code: string; chapter: number }
  | { kind: 'note'; title: string; text: string }

export interface ShowSlide {
  label: string
  text: string
  reference: string
  /** Номер стиха (VerseId) — только для kind='bible' */
  verse?: number
  /** Тот же стих во втором переводе — только для kind='bible' */
  secondary?: { text: string; reference: string }
}

/** Язык названий книг для перевода */
function langOf(translation: string): 'kz' | 'ky' | 'ru' {
  return translation === 'KTB' ? 'kz' : translation === 'KYB' ? 'ky' : 'ru'
}

interface VerseContext {
  canonicalCode: string
  chapter: number
}

class ShowState {
  title = $state('')
  subtitle = $state('')
  kind = $state<'song' | 'bible' | 'note' | null>(null)
  /** Откуда открыт текущий элемент — для истории и повторного открытия */
  source: ShowSource | null = null
  /** Название без секции (для песен) — под ним элемент попадает в историю */
  baseReference = ''
  slides = $state<ShowSlide[]>([])
  previewIdx = $state(0)
  liveIdx = $state(-1)
  /** Подсвеченная строка живого слайда песни — порядковый среди непустых */
  liveLine = $state(0)
  blackout = $state(false)
  /** Контекст главы для смены перевода */
  verseCtx: VerseContext | null = null
  /**
   * Фон открытого пункта порядка служения — ждёт первого GO. Любая загрузка
   * (песня, глава, заметка) сбрасывает его; порядок служения ставит заново.
   */
  itemBackground: { preset: string; palette: PaletteId } | null = null
  /** Второй перевод на экране (параллельный показ); null — выключен */
  secondaryCode = $state<string | null>(null)

  get previewSlide(): ShowSlide | null {
    return this.slides[this.previewIdx] ?? null
  }
  get liveSlide(): ShowSlide | null {
    return this.slides[this.liveIdx] ?? null
  }

  loadSong(song: SongRow) {
    this.itemBackground = null
    const sections = splitSongSections(song.text) as Array<{
      label: string
      rawText: string
    }>
    const base = song.songNumber ? `${song.title} · № ${song.songNumber}` : song.title
    this.kind = 'song'
    this.verseCtx = null
    this.source = { kind: 'song', id: song.id }
    this.baseReference = base
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

    const title = getBookTitle(canonicalCode, langOf(translation)) as string

    this.itemBackground = null
    this.kind = 'bible'
    this.verseCtx = { canonicalCode, chapter }
    this.source = { kind: 'bible', code: canonicalCode, chapter }
    this.baseReference = `${title} ${chapter}`
    this.title = `${title} ${chapter}`
    this.subtitle = translation
    this.slides = chap.Verses.map((v) => ({
      label: `Стих ${v.VerseId}`,
      // Сохранённая оператором правка имеет приоритет над оригиналом
      text:
        edits.get(translation, canonicalCode, chapter, v.VerseId) ??
        v.Text.replace(/<[^>]*>/g, ''),
      reference: `${title} ${chapter}:${v.VerseId}`,
      verse: v.VerseId,
      secondary: this.secondaryFor(canonicalCode, chapter, v.VerseId),
    }))
    const idx = chap.Verses.findIndex((v) => v.VerseId === previewVerse)
    this.previewIdx = idx >= 0 ? idx : 0
    this.liveIdx = -1
    return true
  }

  /**
   * Тот же стих во втором переводе — по canonical code, главе и VerseId.
   * Нет второго перевода, он ещё не загружен или стиха в нём нет — undefined:
   * слайд идёт одним переводом, а не с пустым местом.
   */
  private secondaryFor(
    canonicalCode: string,
    chapter: number,
    verse: number,
  ): ShowSlide['secondary'] {
    const code = this.secondaryCode
    if (!code || code === data.translation) return undefined
    const db = data.bibles[code]
    if (!db) return undefined
    const bookId = getBookId(canonicalCode, code)
    const found = db.Books.find((b) => b.BookId === bookId)
      ?.Chapters.find((c) => c.ChapterId === chapter)
      ?.Verses.find((v) => v.VerseId === verse)
    if (!found) return undefined
    const title = getBookTitle(canonicalCode, langOf(code)) as string
    return {
      text: edits.get(code, canonicalCode, chapter, verse) ?? found.Text.replace(/<[^>]*>/g, ''),
      reference: `${title} ${chapter}:${verse}`,
    }
  }

  /** Сменился второй перевод или он догрузился — пересобрать вторые тексты главы */
  refreshSecondary() {
    const ctx = this.verseCtx
    if (this.kind !== 'bible' || !ctx) return
    this.slides = this.slides.map((s) =>
      s.verse === undefined
        ? s
        : { ...s, secondary: this.secondaryFor(ctx.canonicalCode, ctx.chapter, s.verse) },
    )
  }

  /**
   * Индекс слайда для номера стиха: точное совпадение, иначе ближайший
   * меньший, иначе первый. Нумерация стихов между переводами расходится —
   * перенос по индексу показал бы другой стих.
   */
  private indexForVerse(verse: number): number {
    let best = 0
    for (let i = 0; i < this.slides.length; i++) {
      const v = this.slides[i].verse
      if (v === undefined) continue
      if (v === verse) return i
      if (v < verse) best = i
    }
    return best
  }

  /** Перезагрузить текущую главу после смены перевода, сохранив позицию по VerseId */
  reloadForTranslation() {
    if (this.kind !== 'bible' || !this.verseCtx) return
    const previewVerse = this.previewSlide?.verse ?? 1
    const liveVerse = this.liveIdx >= 0 ? this.liveSlide?.verse : undefined
    const ctx = this.verseCtx
    if (!this.loadChapter(ctx.canonicalCode, ctx.chapter, previewVerse)) return
    this.previewIdx = this.indexForVerse(previewVerse)
    if (liveVerse !== undefined) this.liveIdx = this.indexForVerse(liveVerse)
  }

  /** Заметка: один слайд, заголовок в reference */
  loadNote(title: string, text: string) {
    this.itemBackground = null
    this.kind = 'note'
    this.verseCtx = null
    this.source = { kind: 'note', title, text }
    this.baseReference = title
    this.title = title
    this.subtitle = 'Заметка'
    this.slides = [{ label: 'Заметка', text, reference: title }]
    this.previewIdx = 0
    this.liveIdx = -1
  }

  /** Правка текста слайда; для стихов — с сохранением */
  updateSlideText(index: number, text: string) {
    const slide = this.slides[index]
    if (!slide) return
    this.slides[index] = { ...slide, text }
    if (this.kind === 'bible' && this.verseCtx && slide.verse !== undefined) {
      edits.save(data.translation, this.verseCtx.canonicalCode, this.verseCtx.chapter, slide.verse, text)
    }
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

  /**
   * Шаг подсветки по строкам живого слайда песни. true — шаг сделан и GO
   * дальше не идёт. Работает только в естественном потоке: в превью стоит
   * следующий слайд (или последний уже в эфире). Выбрал оператор в превью
   * что-то другое — GO отправляет выбранное, как обычно.
   */
  stepLine(): boolean {
    if (this.kind !== 'song' || this.blackout) return false
    const live = this.liveSlide
    if (!live) return false
    const natural =
      this.previewIdx === this.liveIdx + 1 ||
      (this.previewIdx === this.liveIdx && this.liveIdx === this.slides.length - 1)
    if (!natural || this.liveLine >= singableLines(live.text) - 1) return false
    this.liveLine++
    return true
  }

  go() {
    if (!this.slides.length) return
    this.liveLine = 0
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
