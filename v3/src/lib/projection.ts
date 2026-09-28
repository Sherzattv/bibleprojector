/**
 * Протокол проекции: что именно показывает экран.
 * Чистые функции — покрыты tests/projection.test.ts.
 */
import {
  DEFAULT_BACKGROUND,
  normalizeBackground,
  type BackgroundSettings,
} from './backgrounds/settings'
import { NO_MEDIA, normalizeMediaRefs, type MediaRefs } from './media'
import { DEFAULT_PULSE, normalizePulse, type PulseSettings } from './pulse'

/** Как один слайд сменяет другой на экране */
export type TransitionKind = 'cut' | 'fade' | 'blur' | 'lines' | 'rise'
export const TRANSITION_KINDS: readonly TransitionKind[] = ['cut', 'fade', 'blur', 'lines', 'rise']
export const TRANSITION_MS_MIN = 150
export const TRANSITION_MS_MAX = 1600

export type FontFamily = 'serif' | 'sans'

/**
 * Гротеск при том же кегле заметно шире и выше антиквы: без поправки
 * длинный куплет, влезавший с засечками, вылезает за экран
 */
export const FONT_SIZE_FACTOR: Record<FontFamily, number> = { serif: 1, sans: 0.88 }

/**
 * Вывод: весь экран (проектор) или нижняя треть для трансляции — текст
 * плашкой внизу поверх хромакея или прозрачного фона (источник «Браузер» в OBS)
 */
export type OutputLayout = 'full' | 'lower-third'
export type ChromaKey = 'green' | 'transparent'

export interface ProjectionSettings {
  fontScale: number
  showReference: boolean
  /** Мягкая тень под текстом — отделяет буквы от светлых участков фона */
  textShadow: boolean
  /** С засечками (как раньше) или без — для проекции часто советуют без */
  fontFamily: FontFamily
  transition: TransitionKind
  /** Длительность перехода и затемнения, мс */
  transitionMs: number
  /** В песнях подсвечивать текущую строку, пропетые — приглушать */
  lineHighlight: boolean
  layout: OutputLayout
  chroma: ChromaKey
  background: BackgroundSettings
  /** Свои файлы: версии, по которым экран понимает, что пора перезапросить */
  media: MediaRefs
  pulse: PulseSettings
}

export const DEFAULT_PROJECTION_SETTINGS: ProjectionSettings = {
  fontScale: 1,
  showReference: true,
  textShadow: true,
  fontFamily: 'serif',
  transition: 'fade',
  transitionMs: 400,
  lineHighlight: false,
  layout: 'full',
  chroma: 'green',
  background: DEFAULT_BACKGROUND,
  media: NO_MEDIA,
  pulse: DEFAULT_PULSE,
}

/**
 * Настройки, пришедшие по каналу, экран не принимает на веру: пульт другой
 * версии или битое сообщение не должны ронять проекцию посреди служения.
 */
export function normalizeProjectionSettings(raw: unknown): ProjectionSettings {
  const d = DEFAULT_PROJECTION_SETTINGS
  if (!raw || typeof raw !== 'object') {
    return { ...d, background: { ...d.background }, media: { ...d.media }, pulse: { ...d.pulse } }
  }
  const r = raw as Record<string, unknown>
  return {
    fontScale:
      typeof r.fontScale === 'number' && Number.isFinite(r.fontScale)
        ? Math.min(2, Math.max(0.5, r.fontScale))
        : d.fontScale,
    showReference: typeof r.showReference === 'boolean' ? r.showReference : d.showReference,
    textShadow: typeof r.textShadow === 'boolean' ? r.textShadow : d.textShadow,
    fontFamily: r.fontFamily === 'sans' || r.fontFamily === 'serif' ? r.fontFamily : d.fontFamily,
    transition: TRANSITION_KINDS.includes(r.transition as TransitionKind)
      ? (r.transition as TransitionKind)
      : d.transition,
    transitionMs:
      typeof r.transitionMs === 'number' && Number.isFinite(r.transitionMs)
        ? Math.round(Math.min(TRANSITION_MS_MAX, Math.max(TRANSITION_MS_MIN, r.transitionMs)))
        : d.transitionMs,
    lineHighlight: typeof r.lineHighlight === 'boolean' ? r.lineHighlight : d.lineHighlight,
    layout: r.layout === 'lower-third' || r.layout === 'full' ? r.layout : d.layout,
    chroma: r.chroma === 'transparent' || r.chroma === 'green' ? r.chroma : d.chroma,
    background: normalizeBackground(r.background),
    media: normalizeMediaRefs(r.media),
    pulse: normalizePulse(r.pulse),
  }
}

/** Служебные экраны — перекрывают слайды, пока включены */
export type ServiceContent =
  /** Отсчёт: endsAt — момент окончания (идёт), иначе стоит на leftMs */
  | { kind: 'countdown'; endsAt: number | null; leftMs: number; title: string; subtitle: string }
  | { kind: 'welcome'; name: string; announcements: string[] }

export type ProjectionContent =
  | ServiceContent
  | { kind: 'empty' }
  | { kind: 'blackout' }
  /** line — порядковый номер подсвеченной строки среди непустых (только песни) */
  | { kind: 'slide'; text: string; reference: string; line?: number }
  | { kind: 'note'; text: string; title: string }

export function buildContent(input: {
  blackout: boolean
  kind: 'song' | 'bible' | 'note' | null
  liveSlide: { text: string; reference: string } | null
  /** Подсвеченная строка песни; undefined — подсветка выключена */
  line?: number
  /** Включённый служебный экран перекрывает слайды */
  service?: ServiceContent | null
}): ProjectionContent {
  if (input.blackout) return { kind: 'blackout' }
  if (input.service) return input.service
  if (!input.liveSlide || !input.kind) return { kind: 'empty' }
  if (input.kind === 'note') {
    return { kind: 'note', text: input.liveSlide.text, title: input.liveSlide.reference }
  }
  const slide = {
    kind: 'slide' as const,
    text: input.liveSlide.text,
    reference: input.liveSlide.reference,
  }
  return input.kind === 'song' && input.line !== undefined ? { ...slide, line: input.line } : slide
}

/**
 * Строки, которые можно подсветить: непустые. Пустые строки в песне —
 * вёрстка, на них подсветка не останавливается.
 */
export function singableLines(text: string): number {
  return text.split('\n').filter((l) => l.trim()).length
}

/** Текст плашки нижней трети: строки в одну; с подсветкой — только текущая строка песни */
export function lowerThirdText(text: string, line: number | undefined): string {
  const lines = text.split('\n').filter((l) => l.trim())
  if (line !== undefined && lines[line]) return lines[line]
  return lines.join(' ')
}

/** Фон под нижней третью: хромакей или шахматка «прозрачно», как в редакторах */
export const CHROMA_BACKGROUND: Record<ChromaKey, string> = {
  green: '#00b140',
  transparent: 'repeating-conic-gradient(#3a3d42 0% 25%, #2a2c30 0% 50%) 0 0 / 16px 16px',
}

export type LineState = 'current' | 'sung' | 'ahead'

/**
 * Разметка строк слайда для подсветки. line — порядковый номер среди
 * непустых; undefined — подсветки нет, у всех строк state null.
 */
export function lineStates(
  text: string,
  line: number | undefined,
): Array<{ text: string; state: LineState | null }> {
  let ordinal = -1
  return text.split('\n').map((l) => {
    if (line === undefined || !l.trim()) return { text: l, state: null }
    ordinal++
    const state: LineState = ordinal === line ? 'current' : ordinal < line ? 'sung' : 'ahead'
    return { text: l, state }
  })
}

/** Непрозрачность строки: текущая яркая, пропетые уходят в тень */
export const LINE_OPACITY: Record<LineState, number> = { current: 1, sung: 0.35, ahead: 0.6 }
