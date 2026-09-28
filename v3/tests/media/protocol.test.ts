import { describe, it, expect } from 'vitest'
import {
  MEDIA_LIMITS,
  isMediaPayload,
  mediaKind,
  normalizeMediaRefs,
  validateMedia,
} from '../src/lib/media'

const MB = 1024 * 1024

describe('validateMedia', () => {
  it('фон: картинка и MP4/WebM проходят', () => {
    expect(validateMedia('background', { type: 'image/jpeg', size: 3 * MB })).toBeNull()
    expect(validateMedia('background', { type: 'video/mp4', size: 20 * MB })).toBeNull()
    expect(validateMedia('background', { type: 'video/webm', size: 1 * MB })).toBeNull()
  })

  it('фон: чужие форматы и превышение лимитов — понятный отказ', () => {
    expect(validateMedia('background', { type: 'video/quicktime', size: MB })).toMatch(/MP4\/WebM/)
    expect(validateMedia('background', { type: 'application/pdf', size: MB })).toMatch(
      /картинка или видео/,
    )
    expect(
      validateMedia('background', { type: 'image/png', size: MEDIA_LIMITS.image + 1 }),
    ).toMatch(/10 МБ/)
    expect(
      validateMedia('background', { type: 'video/mp4', size: MEDIA_LIMITS.video + 1 }),
    ).toMatch(/40 МБ/)
  })

  it('логотип: только картинка до 2 МБ', () => {
    expect(validateMedia('logo', { type: 'image/svg+xml', size: 20_000 })).toBeNull()
    expect(validateMedia('logo', { type: 'video/mp4', size: 20_000 })).toMatch(/картинкой/)
    expect(validateMedia('logo', { type: 'image/png', size: 3 * MB })).toMatch(/2 МБ/)
  })

  it('mediaKind: видео по типу, остальное — картинка', () => {
    expect(mediaKind('video/mp4')).toBe('video')
    expect(mediaKind('image/webp')).toBe('image')
  })
})

describe('normalizeMediaRefs', () => {
  it('мусор — файлов нет', () => {
    expect(normalizeMediaRefs(null)).toEqual({ background: null, logo: null })
    expect(normalizeMediaRefs({ background: { version: '', kind: 'image' }, logo: 5 })).toEqual({
      background: null,
      logo: null,
    })
    expect(normalizeMediaRefs({ background: { version: 'v1', kind: 'gif' } }).background).toBeNull()
  })

  it('валидные ссылки проходят', () => {
    const refs = {
      background: { version: 'v1', kind: 'video' },
      logo: { version: 'v2', kind: 'image' },
    }
    expect(normalizeMediaRefs(refs)).toEqual(refs)
  })
})

describe('isMediaPayload', () => {
  it('принимает data-URL и удаление (null)', () => {
    expect(
      isMediaPayload({ slot: 'logo', version: 'v', dataUrl: 'data:image/png;base64,AAAA' }),
    ).toBe(true)
    expect(isMediaPayload({ slot: 'background', version: '', dataUrl: null })).toBe(true)
  })

  it('отвергает чужие слоты и не-data URL — экран не грузит что попало', () => {
    expect(isMediaPayload({ slot: 'music', version: 'v', dataUrl: null })).toBe(false)
    expect(
      isMediaPayload({ slot: 'logo', version: 'v', dataUrl: 'https://example.com/x.png' }),
    ).toBe(false)
    expect(isMediaPayload({ slot: 'logo', dataUrl: null })).toBe(false)
    expect(isMediaPayload(null)).toBe(false)
  })
})
