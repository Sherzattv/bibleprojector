import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Страж контраста WCAG для дизайн-токенов из src/app.css (@theme).
// Аудит: --color-faint (#5c6370) даёт ~3.1:1 на panel/bg — ниже AA 4.5:1
// для мелкого текста. Два ассерта про faint КРАСНЫЕ до исправления токена.

const cssPath = fileURLToPath(new URL('../src/app.css', import.meta.url))
const css = readFileSync(cssPath, 'utf8')

const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

function token(name: string): string | undefined {
  return themeBlock.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))?.[1]
}

const bg = token('bg')
const panel = token('panel')
const ink = token('ink')
const muted = token('muted')
const faint = token('faint')
const accent = token('accent')

// ── WCAG-математика ────────────────────────────────────

function linearize(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = linearize((n >> 16) & 0xff)
  const g = linearize((n >> 8) & 0xff)
  const b = linearize(n & 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bgHex: string): number {
  const l1 = luminance(fg)
  const l2 = luminance(bgHex)
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// ── Тесты ──────────────────────────────────────────────

describe('парсер токенов @theme', () => {
  it('находит все 6 цветов (иначе остальные ассерты бессмысленны)', () => {
    expect(bg, '--color-bg').toBeDefined()
    expect(panel, '--color-panel').toBeDefined()
    expect(ink, '--color-ink').toBeDefined()
    expect(muted, '--color-muted').toBeDefined()
    expect(faint, '--color-faint').toBeDefined()
    expect(accent, '--color-accent').toBeDefined()
  })
})

describe('контраст WCAG дизайн-токенов', () => {
  it('faint на panel ≥ 4.5:1 (AA, мелкий текст) — красный до исправления токена', () => {
    expect(contrast(faint!, panel!)).toBeGreaterThanOrEqual(4.5)
  })

  it('faint на bg ≥ 4.5:1 (AA, мелкий текст) — красный до исправления токена', () => {
    expect(contrast(faint!, bg!)).toBeGreaterThanOrEqual(4.5)
  })

  it('muted на panel ≥ 4.5:1 (AA, мелкий текст)', () => {
    expect(contrast(muted!, panel!)).toBeGreaterThanOrEqual(4.5)
  })

  it('ink на bg ≥ 7:1 (AAA, основной текст)', () => {
    expect(contrast(ink!, bg!)).toBeGreaterThanOrEqual(7)
  })

  it('accent на bg ≥ 3:1 (крупные элементы и иконки)', () => {
    expect(contrast(accent!, bg!)).toBeGreaterThanOrEqual(3)
  })
})
