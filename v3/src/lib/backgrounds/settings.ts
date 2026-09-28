/**
 * Настройки живого фона: что едет на экран проектора и что хранится.
 * Чистые функции — покрыты tests/backgrounds.test.ts.
 */
import { BACKGROUNDS, PALETTES, findPreset, type PaletteId } from './catalog'

export interface BackgroundSettings {
  /** id из BACKGROUNDS */
  preset: string
  palette: PaletteId
  /** Множитель скорости анимации; 0 — фон замирает */
  speed: number
  /** Затемнение поверх фона, 0..0.8 — главный рычаг читаемости текста */
  dim: number
  /** Сила виньетки по краям, 0..1 */
  vignette: number
  /** Зерно против полос градиента на проекторе */
  grain: boolean
  /** Доля разрешения экрана, в которой рисуется фон */
  quality: 0.5 | 0.75 | 1
  /** Потолок частоты кадров */
  fps: 30 | 60
}

/** По умолчанию — прежний чёрный экран: обновление ничего не меняет само */
export const DEFAULT_BACKGROUND: BackgroundSettings = {
  preset: 'black',
  palette: 'midnight',
  speed: 1,
  dim: 0.25,
  vignette: 0.5,
  grain: true,
  quality: 0.5,
  fps: 30,
}

export const SPEED_MAX = 2
export const DIM_MAX = 0.8

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
}

/** Разобрать что угодно (хранилище, сообщение канала) в валидные настройки */
export function normalizeBackground(raw: unknown): BackgroundSettings {
  const d = DEFAULT_BACKGROUND
  if (!raw || typeof raw !== 'object') return { ...d }
  const r = raw as Record<string, unknown>
  return {
    preset:
      typeof r.preset === 'string' && BACKGROUNDS.some((b) => b.id === r.preset)
        ? r.preset
        : d.preset,
    palette:
      typeof r.palette === 'string' && PALETTES.some((p) => p.id === r.palette)
        ? (r.palette as PaletteId)
        : d.palette,
    speed: clampNumber(r.speed, 0, SPEED_MAX, d.speed),
    dim: clampNumber(r.dim, 0, DIM_MAX, d.dim),
    vignette: clampNumber(r.vignette, 0, 1, d.vignette),
    grain: typeof r.grain === 'boolean' ? r.grain : d.grain,
    quality: r.quality === 0.75 || r.quality === 1 || r.quality === 0.5 ? r.quality : d.quality,
    fps: r.fps === 60 || r.fps === 30 ? r.fps : d.fps,
  }
}

/** Фон рисуется (не чёрный экран) — от этого зависит, нужен ли рендер вообще */
export function isAnimated(s: BackgroundSettings): boolean {
  return findPreset(s.preset).kind !== 'none'
}
