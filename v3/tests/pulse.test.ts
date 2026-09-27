import { describe, it, expect } from 'vitest'
import {
  BPM_MAX,
  BPM_MIN,
  MIC_DEPTH,
  TEMPO_DEPTH,
  normalizePulse,
  pulseGain,
  rmsLevel,
  tapTempo,
} from '../src/lib/pulse'

describe('normalizePulse', () => {
  it('по умолчанию выключен, 72 удара', () => {
    expect(normalizePulse(undefined)).toEqual({ mode: 'off', bpm: 72 })
  })

  it('клампит темп и отбрасывает чужой режим', () => {
    expect(normalizePulse({ mode: 'disco', bpm: 400 })).toEqual({ mode: 'off', bpm: BPM_MAX })
    expect(normalizePulse({ mode: 'mic', bpm: 10 })).toEqual({ mode: 'mic', bpm: BPM_MIN })
  })
})

describe('tapTempo', () => {
  it('нужно хотя бы три нажатия', () => {
    expect(tapTempo([0, 500], 500)).toBeNull()
  })

  it('нажатия каждые 500 мс — 120 ударов', () => {
    expect(tapTempo([0, 500, 1000, 1500], 1500)).toBe(120)
  })

  it('старые нажатия (дольше 3 с) не учитываются', () => {
    expect(tapTempo([0, 100, 5000, 5750, 6500], 6500)).toBe(80)
  })

  it('темп клампится в допустимые пределы', () => {
    expect(tapTempo([0, 100, 200, 300], 300)).toBe(BPM_MAX)
  })
})

describe('pulseGain', () => {
  it('выключено — ровно 1', () => {
    expect(pulseGain('off', 12345, 72, 1)).toBe(1)
  })

  it('темп: пик на доле, спад между долями, в пределах глубины', () => {
    // 60 уд/мин — доля каждую секунду; t=0 — пик, t=0.5с — минимум
    expect(pulseGain('tempo', 0, 60, 0)).toBeCloseTo(1 + TEMPO_DEPTH, 6)
    expect(pulseGain('tempo', 500, 60, 0)).toBeCloseTo(1, 6)
    expect(pulseGain('tempo', 1000, 60, 0)).toBeCloseTo(1 + TEMPO_DEPTH, 6)
  })

  it('микрофон: громче — ярче, но не больше глубины', () => {
    expect(pulseGain('mic', 0, 72, 0)).toBe(1)
    expect(pulseGain('mic', 0, 72, 0.1)).toBeGreaterThan(1)
    expect(pulseGain('mic', 0, 72, 5)).toBe(1 + MIC_DEPTH)
  })
})

describe('rmsLevel', () => {
  it('тишина (128) — 0, максимум размаха — около 1', () => {
    expect(rmsLevel(new Uint8Array(64).fill(128))).toBe(0)
    const loud = Uint8Array.from({ length: 64 }, (_, i) => (i % 2 ? 0 : 255))
    expect(rmsLevel(loud)).toBeGreaterThan(0.99)
    expect(rmsLevel([])).toBe(0)
  })
})
