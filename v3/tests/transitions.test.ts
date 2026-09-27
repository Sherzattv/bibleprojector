import { describe, it, expect } from 'vitest'
import { lineIn, slideIn, slideOut } from '../src/lib/transitions'
import { TRANSITION_KINDS } from '../src/lib/projection'

const node = {} as Element

describe('переходы слайдов', () => {
  it('«Резко» — ничего не анимирует ни на входе, ни на выходе', () => {
    expect(slideIn(node, { kind: 'cut', ms: 800 }).duration).toBe(0)
    expect(slideOut(node, { kind: 'cut', ms: 800 }).duration).toBe(0)
    expect(lineIn(node, { kind: 'cut', ms: 800, index: 2 }).duration).toBe(0)
  })

  it('уходящий слайд короче входящего — тексты не висят друг на друге', () => {
    for (const kind of TRANSITION_KINDS) {
      if (kind === 'cut') continue
      const out = slideOut(node, { kind, ms: 1000 }).duration ?? 0
      expect(out, kind).toBeGreaterThan(0)
      expect(out, kind).toBeLessThan(1000)
    }
  })

  it('на середине перехода текст полупрозрачный, в конце — полностью виден', () => {
    for (const kind of ['fade', 'blur', 'rise'] as const) {
      const cfg = slideIn(node, { kind, ms: 600 })
      expect(cfg.css?.(1, 0), kind).toMatch(/opacity: 1(;|$)/)
      expect(cfg.css?.(0.5, 0.5), kind).toMatch(/opacity: 0\.5/)
    }
  })

  it('из размытия: в начале размыто, в конце резко', () => {
    const cfg = slideIn(node, { kind: 'blur', ms: 600 })
    expect(cfg.css?.(0, 1)).toContain('blur(12px)')
    expect(cfg.css?.(1, 0)).toContain('blur(0px)')
  })

  it('«По строкам»: контейнер сразу, строки выходят по очереди', () => {
    expect(slideIn(node, { kind: 'lines', ms: 700 }).duration).toBe(0)
    const delays = [0, 1, 2, 3].map(
      (index) => lineIn(node, { kind: 'lines', ms: 700, index }).delay,
    )
    expect(delays).toEqual([...delays].sort((a, b) => (a ?? 0) - (b ?? 0)))
    expect(new Set(delays).size).toBe(4)
  })

  it('строки анимируются только в переходе «По строкам»', () => {
    for (const kind of ['fade', 'blur', 'rise'] as const) {
      expect(lineIn(node, { kind, ms: 700, index: 1 }).duration, kind).toBe(0)
    }
  })
})
