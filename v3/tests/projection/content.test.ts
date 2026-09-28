import { describe, it, expect } from 'vitest'
import {
  buildContent,
  normalizeProjectionSettings,
  DEFAULT_PROJECTION_SETTINGS,
  lineStates,
  lowerThirdText,
  singableLines,
} from '../../src/lib/projection/content'

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

describe('normalizeProjectionSettings: шрифт, переход, подсветка', () => {
  it('дефолты: засечки, плавная смена 400 мс, подсветка выключена', () => {
    expect(normalizeProjectionSettings({})).toMatchObject({
      fontFamily: 'serif',
      transition: 'fade',
      transitionMs: 400,
      lineHighlight: false,
    })
  })

  it('мусор отбрасывается, длительность клампится', () => {
    expect(
      normalizeProjectionSettings({
        fontFamily: 'comic',
        transition: 'взрыв',
        transitionMs: 99999,
        lineHighlight: 'да',
      }),
    ).toMatchObject({
      fontFamily: 'serif',
      transition: 'fade',
      transitionMs: 1600,
      lineHighlight: false,
    })
    expect(normalizeProjectionSettings({ transitionMs: 1 }).transitionMs).toBe(150)
  })

  it('валидные значения проходят', () => {
    expect(
      normalizeProjectionSettings({
        fontFamily: 'sans',
        transition: 'lines',
        transitionMs: 900,
        lineHighlight: true,
      }),
    ).toMatchObject({
      fontFamily: 'sans',
      transition: 'lines',
      transitionMs: 900,
      lineHighlight: true,
    })
  })
})

describe('buildContent: подсветка строки', () => {
  it('в песне номер строки едет на экран', () => {
    expect(
      buildContent({ blackout: false, kind: 'song', liveSlide: slide, line: 2 }),
    ).toMatchObject({
      kind: 'slide',
      line: 2,
    })
  })

  it('в Библии и без подсветки поля line нет', () => {
    expect(
      buildContent({ blackout: false, kind: 'bible', liveSlide: slide, line: 1 }),
    ).not.toHaveProperty('line')
    expect(buildContent({ blackout: false, kind: 'song', liveSlide: slide })).not.toHaveProperty(
      'line',
    )
  })
})

describe('строки для подсветки', () => {
  const text = 'Первая\n\nВторая\nТретья'

  it('singableLines считает только непустые строки', () => {
    expect(singableLines(text)).toBe(3)
    expect(singableLines('')).toBe(0)
  })

  it('lineStates: пропетые, текущая и следующие; пустые строки без состояния', () => {
    expect(lineStates(text, 1).map((l) => l.state)).toEqual(['sung', null, 'current', 'ahead'])
  })

  it('без подсветки состояний нет, текст строк сохраняется', () => {
    const states = lineStates(text, undefined)
    expect(states.map((l) => l.state)).toEqual([null, null, null, null])
    expect(states.map((l) => l.text)).toEqual(['Первая', '', 'Вторая', 'Третья'])
  })
})

describe('buildContent: служебные экраны', () => {
  const countdown = {
    kind: 'countdown' as const,
    endsAt: 123,
    leftMs: 0,
    title: 'Начало через',
    subtitle: '',
  }

  it('включённая заставка перекрывает слайд в эфире', () => {
    expect(
      buildContent({ blackout: false, kind: 'song', liveSlide: slide, service: countdown }),
    ).toEqual(countdown)
  })

  it('blackout сильнее заставки', () => {
    expect(
      buildContent({ blackout: true, kind: null, liveSlide: null, service: countdown }),
    ).toEqual({ kind: 'blackout' })
  })

  it('заставка видна и без слайда в эфире', () => {
    const welcome = { kind: 'welcome' as const, name: 'Слово', announcements: [] }
    expect(
      buildContent({ blackout: false, kind: null, liveSlide: null, service: welcome }),
    ).toEqual(welcome)
  })
})

describe('normalizeProjectionSettings: вывод', () => {
  it('по умолчанию весь экран, хромакей зелёный', () => {
    expect(normalizeProjectionSettings({})).toMatchObject({ layout: 'full', chroma: 'green' })
  })

  it('нижняя треть на прозрачном проходит, мусор — нет', () => {
    expect(
      normalizeProjectionSettings({ layout: 'lower-third', chroma: 'transparent' }),
    ).toMatchObject({
      layout: 'lower-third',
      chroma: 'transparent',
    })
    expect(normalizeProjectionSettings({ layout: 'сбоку', chroma: 'синий' })).toMatchObject({
      layout: 'full',
      chroma: 'green',
    })
  })
})

describe('normalizeProjectionSettings: свои файлы', () => {
  it('по умолчанию своих файлов нет', () => {
    const s = normalizeProjectionSettings({})
    expect(s.media).toEqual({ background: null, logo: null })
  })

  it('ссылки на файлы проходят нормализацию', () => {
    const s = normalizeProjectionSettings({
      media: { background: { version: 'v1', kind: 'video' } },
    })
    expect(s.media.background).toEqual({ version: 'v1', kind: 'video' })
  })
})

describe('lowerThirdText: текст плашки нижней трети', () => {
  it('строки слайда в одну, пустые выпадают', () => {
    expect(lowerThirdText('Первая\n\nВторая', undefined)).toBe('Первая Вторая')
  })

  it('с подсветкой — только текущая строка песни', () => {
    expect(lowerThirdText('Первая\n\nВторая', 1)).toBe('Вторая')
  })

  it('номер строки за пределами — весь текст', () => {
    expect(lowerThirdText('Одна', 5)).toBe('Одна')
  })
})

describe('normalizeProjectionSettings: пульс убран в 3.2.2', () => {
  it('старое поле pulse из хранилища молча отбрасывается', () => {
    const s = normalizeProjectionSettings({ pulse: { mode: 'mic', bpm: 90 } })
    expect(s).not.toHaveProperty('pulse')
  })
})
