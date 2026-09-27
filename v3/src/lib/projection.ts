/**
 * Протокол проекции: что именно показывает экран.
 * Чистые функции — покрыты tests/projection.test.ts.
 */
import {
  DEFAULT_BACKGROUND,
  normalizeBackground,
  type BackgroundSettings,
} from './backgrounds/settings'

export interface ProjectionSettings {
  fontScale: number
  showReference: boolean
  /** Мягкая тень под текстом — отделяет буквы от светлых участков фона */
  textShadow: boolean
  background: BackgroundSettings
}

export const DEFAULT_PROJECTION_SETTINGS: ProjectionSettings = {
  fontScale: 1,
  showReference: true,
  textShadow: true,
  background: DEFAULT_BACKGROUND,
}

/**
 * Настройки, пришедшие по каналу, экран не принимает на веру: пульт другой
 * версии или битое сообщение не должны ронять проекцию посреди служения.
 */
export function normalizeProjectionSettings(raw: unknown): ProjectionSettings {
  const d = DEFAULT_PROJECTION_SETTINGS
  if (!raw || typeof raw !== 'object') return { ...d, background: { ...d.background } }
  const r = raw as Record<string, unknown>
  return {
    fontScale:
      typeof r.fontScale === 'number' && Number.isFinite(r.fontScale)
        ? Math.min(2, Math.max(0.5, r.fontScale))
        : d.fontScale,
    showReference: typeof r.showReference === 'boolean' ? r.showReference : d.showReference,
    textShadow: typeof r.textShadow === 'boolean' ? r.textShadow : d.textShadow,
    background: normalizeBackground(r.background),
  }
}

export type ProjectionContent =
  | { kind: 'empty' }
  | { kind: 'blackout' }
  | { kind: 'slide'; text: string; reference: string }
  | { kind: 'note'; text: string; title: string }

export function buildContent(input: {
  blackout: boolean
  kind: 'song' | 'bible' | 'note' | null
  liveSlide: { text: string; reference: string } | null
}): ProjectionContent {
  if (input.blackout) return { kind: 'blackout' }
  if (!input.liveSlide || !input.kind) return { kind: 'empty' }
  if (input.kind === 'note') {
    return { kind: 'note', text: input.liveSlide.text, title: input.liveSlide.reference }
  }
  return { kind: 'slide', text: input.liveSlide.text, reference: input.liveSlide.reference }
}
