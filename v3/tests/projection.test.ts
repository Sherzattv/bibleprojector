import { describe, it, expect } from 'vitest'
import {
  buildContent,
  normalizeProjectionSettings,
  DEFAULT_PROJECTION_SETTINGS,
} from '../src/lib/projection'

const slide = { text: 'Ибо так возлюбил Бог мир', reference: 'От Иоанна 3:16' }

describe('buildContent: blackout', () => {
  it('blackout:true даёт blackout даже при активном liveSlide', () => {
    expect(buildContent({ blackout: true, kind: 'song', liveSlide: slide })).toEqual({
      kind: 'blackout',
    })
  })

  it('blackout:true даёт blackout и без liveSlide', () => {
    expect(buildContent({ blackout: true, kind: null, liveSlide: null })).toEqual({
      kind: 'blackout',
    })
  })

  it('blackout перекрывает и заметку', () => {
    expect(buildContent({ blackout: true, kind: 'note', liveSlide: slide })).toEqual({
      kind: 'blackout',
    })
  })
})

describe('buildContent: пустой экран', () => {
  it('liveSlide null → empty', () => {
    expect(buildContent({ blackout: false, kind: 'song', liveSlide: null })).toEqual({
      kind: 'empty',
    })
  })

  it('kind null → empty, даже если liveSlide есть', () => {
    expect(buildContent({ blackout: false, kind: null, liveSlide: slide })).toEqual({
      kind: 'empty',
    })
  })

  it('kind null и liveSlide null → empty', () => {
    expect(buildContent({ blackout: false, kind: null, liveSlide: null })).toEqual({
      kind: 'empty',
    })
  })
})

describe('buildContent: слайды песни и Библии', () => {
  it('песня → slide с текстом и reference', () => {
    expect(buildContent({ blackout: false, kind: 'song', liveSlide: slide })).toEqual({
      kind: 'slide',
      text: 'Ибо так возлюбил Бог мир',
      reference: 'От Иоанна 3:16',
    })
  })

  it('библия → slide с текстом и reference', () => {
    const bible = { text: 'Как лань желает к потокам воды', reference: 'Псалтирь 41:2' }
    expect(buildContent({ blackout: false, kind: 'bible', liveSlide: bible })).toEqual({
      kind: 'slide',
      text: 'Как лань желает к потокам воды',
      reference: 'Псалтирь 41:2',
    })
  })
})

describe('buildContent: заметка', () => {
  it('note → kind note, reference становится title', () => {
    const note = { text: 'Не забыть объявление о собрании', reference: 'Объявления' }
    expect(buildContent({ blackout: false, kind: 'note', liveSlide: note })).toEqual({
      kind: 'note',
      text: 'Не забыть объявление о собрании',
      title: 'Объявления',
    })
  })

  it('note без liveSlide → empty', () => {
    expect(buildContent({ blackout: false, kind: 'note', liveSlide: null })).toEqual({
      kind: 'empty',
    })
  })
})

describe('normalizeProjectionSettings: экран не верит каналу на слово', () => {
  it('пустое или битое сообщение — настройки по умолчанию', () => {
    expect(normalizeProjectionSettings(null)).toEqual(DEFAULT_PROJECTION_SETTINGS)
    expect(normalizeProjectionSettings('мусор')).toEqual(DEFAULT_PROJECTION_SETTINGS)
  })

  it('пульт 3.1.0 без фона и тени — фон чёрный, тень включена', () => {
    const s = normalizeProjectionSettings({ fontScale: 1.2, showReference: false })
    expect(s).toMatchObject({ fontScale: 1.2, showReference: false, textShadow: true })
    expect(s.background.preset).toBe('black')
  })

  it('масштаб клампится, мусорный фон заменяется дефолтным', () => {
    const s = normalizeProjectionSettings({ fontScale: 10, background: { preset: 42 } })
    expect(s.fontScale).toBe(2)
    expect(s.background).toEqual(DEFAULT_PROJECTION_SETTINGS.background)
  })

  it('валидный фон проходит как есть', () => {
    const background = { ...DEFAULT_PROJECTION_SETTINGS.background, preset: 'snow' }
    expect(normalizeProjectionSettings({ background }).background).toEqual(background)
  })
})
