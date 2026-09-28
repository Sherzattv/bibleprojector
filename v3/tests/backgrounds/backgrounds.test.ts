import { describe, it, expect } from 'vitest'
import {
  BACKGROUNDS,
  BACKGROUND_GROUPS,
  PALETTES,
  findPalette,
  findPreset,
  sceneSource,
} from '../../src/lib/backgrounds/catalog'
import { SCENES } from '../../src/lib/backgrounds/shaders'
import {
  DEFAULT_BACKGROUND,
  isAnimated,
  normalizeBackground,
} from '../../src/lib/backgrounds/settings'
import { contrastLevel, contrastOnBackground } from '../../src/lib/backgrounds/contrast'
import { hexToRgb } from '../../src/lib/backgrounds/renderer'

function luminance(hex: string): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const [r, g, b] = hexToRgb(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Кадр w×h, залитый одним цветом */
function frame(w: number, h: number, rgb: [number, number, number]): Uint8Array {
  const px = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) px.set([...rgb, 255], i * 4)
  return px
}

describe('каталог фонов', () => {
  it('id фонов уникальны', () => {
    const ids = BACKGROUNDS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('у каждого шейдерного фона есть сцена, у остальных — нет', () => {
    for (const b of BACKGROUNDS) {
      if (b.kind === 'shader') expect(sceneSource(b.id), b.id).toMatch(/vec3 scene\(/)
      else expect(sceneSource(b.id), b.id).toBeNull()
    }
  })

  it('в shaders.ts нет сирот — каждая сцена доступна из каталога', () => {
    const shaderIds = BACKGROUNDS.filter((b) => b.kind === 'shader').map((b) => b.id)
    expect(Object.keys(SCENES).sort()).toEqual([...shaderIds].sort())
  })

  it('фон ссылается на существующие группу и палитру', () => {
    const groups = new Set(BACKGROUND_GROUPS.map((g) => g.id))
    const palettes = new Set(PALETTES.map((p) => p.id))
    for (const b of BACKGROUNDS) {
      expect(groups.has(b.group), b.id).toBe(true)
      expect(palettes.has(b.palette), b.id).toBe(true)
    }
  })

  it('в каждой группе есть хотя бы один фон', () => {
    for (const g of BACKGROUND_GROUPS) {
      expect(
        BACKGROUNDS.some((b) => b.group === g.id),
        g.id,
      ).toBe(true)
    }
  })

  it('свой файл — отдельный фон без шейдера в группе «Своё»', () => {
    expect(findPreset('media')).toMatchObject({ kind: 'media', group: 'own' })
    expect(isAnimated({ ...DEFAULT_BACKGROUND, preset: 'media' })).toBe(true)
    expect(normalizeBackground({ preset: 'media' }).preset).toBe('media')
  })

  it('первый фон — чёрный без рендера: он же запасной для неизвестных id', () => {
    expect(BACKGROUNDS[0]).toMatchObject({ id: 'black', kind: 'none' })
    expect(findPreset('нет-такого').id).toBe('black')
  })

  it('палитры: валидный hex, почти чёрная база — белый текст на ней держит AAA', () => {
    for (const p of PALETTES) {
      for (const c of p.colors) expect(c, p.id).toMatch(/^#[0-9a-f]{6}$/)
      const ratio = 1.05 / (luminance(p.colors[0]) + 0.05)
      expect(ratio, p.id).toBeGreaterThan(17)
    }
    expect(findPalette('нет-такой').id).toBe(PALETTES[0].id)
  })
})

describe('normalizeBackground', () => {
  it('мусор и пустота дают дефолт — прежний чёрный экран', () => {
    for (const raw of [null, undefined, 42, 'фон', []]) {
      expect(normalizeBackground(raw)).toEqual(DEFAULT_BACKGROUND)
    }
    expect(DEFAULT_BACKGROUND.preset).toBe('black')
  })

  it('принимает валидные значения как есть', () => {
    const s = {
      preset: 'glass',
      palette: 'amber',
      speed: 0.5,
      dim: 0.4,
      vignette: 0.2,
      grain: false,
      quality: 1,
      fps: 60,
    }
    expect(normalizeBackground(s)).toEqual(s)
  })

  it('клампит числа и отбрасывает неизвестные фон, палитру, разрешение и частоту', () => {
    const s = normalizeBackground({
      preset: 'дискотека',
      palette: 'неон',
      speed: 99,
      dim: -1,
      vignette: Number.NaN,
      grain: 'да',
      quality: 0.3,
      fps: 144,
    })
    expect(s).toEqual({
      ...DEFAULT_BACKGROUND,
      speed: 2,
      dim: 0,
    })
  })

  it('затемнение не выше 0.8 — фон не должен превращаться в чёрный экран', () => {
    expect(normalizeBackground({ dim: 1 }).dim).toBe(0.8)
  })

  it('isAnimated: чёрный — нет, любой другой — да', () => {
    expect(isAnimated(DEFAULT_BACKGROUND)).toBe(false)
    expect(isAnimated({ ...DEFAULT_BACKGROUND, preset: 'flow' })).toBe(true)
  })
})

describe('contrastOnBackground', () => {
  it('чёрный фон — максимальные 21:1', () => {
    expect(contrastOnBackground(frame(40, 20, [0, 0, 0]), 40, 20, 0)).toBeCloseTo(21, 5)
  })

  it('белый фон без затемнения — 1:1, текст не читается', () => {
    expect(contrastOnBackground(frame(40, 20, [255, 255, 255]), 40, 20, 0)).toBeCloseTo(1, 5)
  })

  it('затемнение повышает контраст', () => {
    const grey = frame(40, 20, [128, 128, 128])
    const plain = contrastOnBackground(grey, 40, 20, 0)
    const dimmed = contrastOnBackground(grey, 40, 20, 0.5)
    expect(dimmed).toBeGreaterThan(plain)
  })

  it('считает по светлым участкам: половина кадра белая — контраст как у белого', () => {
    const px = frame(40, 20, [0, 0, 0])
    for (let i = 0; i < 40 * 10; i++) px.set([255, 255, 255, 255], i * 4)
    expect(contrastOnBackground(px, 40, 20, 0, 1)).toBeCloseTo(1, 5)
  })

  it('редкие блики (меньше 5% кадра) не обваливают оценку', () => {
    const px = frame(100, 10, [0, 0, 0])
    for (let i = 0; i < 20; i++) px.set([255, 255, 255, 255], i * 4)
    expect(contrastOnBackground(px, 100, 10, 0, 1)).toBeCloseTo(21, 5)
  })

  it('contrastLevel: 7 и выше — отлично, от 4.5 — нормально, ниже — слабо', () => {
    expect(contrastLevel(21)).toBe('good')
    expect(contrastLevel(7)).toBe('good')
    expect(contrastLevel(5)).toBe('ok')
    expect(contrastLevel(4.49)).toBe('poor')
  })
})
