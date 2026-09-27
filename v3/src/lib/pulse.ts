/**
 * Пульс музыки: фон слегка «дышит» в такт. Чистые функции — покрыты
 * tests/pulse.test.ts.
 *
 * Темп экран считает сам по своим часам — в канал уходит только BPM.
 * Микрофон слушает пульт (разрешение спрашивается у оператора, а не на
 * проекторе) и шлёт экрану уровень громкости ~15 раз в секунду.
 */

export type PulseMode = 'off' | 'tempo' | 'mic'

export interface PulseSettings {
  mode: PulseMode
  bpm: number
}

export const BPM_MIN = 50
export const BPM_MAX = 150
export const DEFAULT_PULSE: PulseSettings = { mode: 'off', bpm: 72 }

/** Насколько ярче становится фон на пике: заметно, но не мигает */
export const TEMPO_DEPTH = 0.14
export const MIC_DEPTH = 0.3

export function normalizePulse(raw: unknown): PulseSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PULSE }
  const r = raw as Record<string, unknown>
  return {
    mode: r.mode === 'tempo' || r.mode === 'mic' || r.mode === 'off' ? r.mode : DEFAULT_PULSE.mode,
    bpm:
      typeof r.bpm === 'number' && Number.isFinite(r.bpm)
        ? Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, r.bpm)))
        : DEFAULT_PULSE.bpm,
  }
}

/**
 * Темп по нажатиям «Тап»: среднее между соседними нажатиями за последние
 * 3 секунды. null — нажатий пока мало (нужно хотя бы три).
 */
export function tapTempo(taps: readonly number[], now: number): number | null {
  const recent = taps.filter((t) => now - t <= 3000)
  if (recent.length < 3) return null
  const gaps = recent.slice(1).map((t, i) => t - recent[i])
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  if (avg <= 0) return null
  return Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, 60_000 / avg)))
}

/**
 * Множитель яркости фона в момент now. Для темпа — мягкий импульс на каждую
 * долю (cos³ — короткий пик и длинная пауза), для микрофона — от уровня.
 */
export function pulseGain(mode: PulseMode, now: number, bpm: number, micLevel: number): number {
  if (mode === 'tempo') {
    const phase = (now / 1000) * (bpm / 60)
    return 1 + TEMPO_DEPTH * Math.pow(0.5 + 0.5 * Math.cos(phase * Math.PI * 2), 3)
  }
  if (mode === 'mic') return 1 + Math.min(MIC_DEPTH, Math.max(0, micLevel) * 1.6)
  return 1
}

/** Громкость кадра микрофона: RMS отсчётов 0..255 вокруг 128 */
export function rmsLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}
