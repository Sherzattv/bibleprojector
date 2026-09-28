import { describe, it, expect, beforeEach } from 'vitest'
import { show } from '../../src/lib/show/show.svelte'
import { data } from '../../src/lib/data/db.svelte'
import { commands } from '../../src/lib/show/commands.svelte'
import { projSettings } from '../../src/lib/projection/settings.svelte'
import { buildContent, normalizeProjectionSettings } from '../../src/lib/projection/content'
import { rstDb, nrtDb, rstShiftDb, nrtShiftDb } from '../fixtures'

beforeEach(() => {
  data.bibles = { RST: rstDb, NRT: nrtDb }
  data.translation = 'RST'
  show.kind = null
  show.slides = []
  show.verseCtx = null
  show.secondaryCode = null
  projSettings.reset()
})

describe('два перевода: второй текст стиха', () => {
  it('без второго перевода слайды как раньше', () => {
    show.loadChapter('JHN', 3)
    expect(show.slides[0].secondary).toBeUndefined()
  })

  it('второй перевод даёт тот же стих по VerseId со своей ссылкой', () => {
    show.secondaryCode = 'NRT'
    show.loadChapter('JHN', 3)
    expect(show.slides[1].secondary?.text).toBe(
      'Ведь Бог так полюбил этот мир, что отдал Своего единственного Сына.',
    )
    expect(show.slides[1].secondary?.reference).toMatch(/3:2$/)
  })

  it('второй перевод совпадает с основным — показывается один', () => {
    show.secondaryCode = 'RST'
    show.loadChapter('JHN', 3)
    expect(show.slides[0].secondary).toBeUndefined()
  })

  it('перевод ещё не загружен — один текст, догрузился — refreshSecondary добавляет', () => {
    data.bibles = { RST: rstDb }
    show.secondaryCode = 'NRT'
    show.loadChapter('JHN', 3)
    expect(show.slides[0].secondary).toBeUndefined()
    data.bibles = { RST: rstDb, NRT: nrtDb }
    show.refreshSecondary()
    expect(show.slides[0].secondary?.text).toContain('Никодим')
  })

  it('стиха нет во втором переводе — у этого слайда один текст, без пустого места', () => {
    // Псалом 41: в RST стихи 1,2,3, в NRT — 1,3,4
    data.bibles = { RST: rstShiftDb, NRT: nrtShiftDb }
    show.secondaryCode = 'NRT'
    show.loadChapter('PSA', 41)
    const byVerse = Object.fromEntries(show.slides.map((s) => [s.verse, s.secondary]))
    expect(byVerse[1]).toBeDefined()
    expect(byVerse[2]).toBeUndefined()
    expect(byVerse[3]).toBeDefined()
  })

  it('commands.setSecondaryTranslation сохраняет выбор и пересобирает главу', () => {
    commands.openRef('JHN', 3, 1)
    commands.setSecondaryTranslation('NRT')
    expect(projSettings.secondaryTranslation).toBe('NRT')
    expect(show.slides[0].secondary).toBeDefined()
    commands.setSecondaryTranslation(null)
    expect(projSettings.secondaryTranslation).toBeNull()
    expect(show.slides[0].secondary).toBeUndefined()
  })
})

describe('два перевода: протокол', () => {
  const liveSlide = {
    text: 'Ибо так возлюбил',
    reference: 'Иоанна 3:16',
    secondary: { text: 'Ведь Бог так полюбил', reference: 'Иоанна 3:16' },
  }

  it('второй текст едет на экран только для Библии', () => {
    expect(buildContent({ blackout: false, kind: 'bible', liveSlide })).toMatchObject({
      secondary: liveSlide.secondary,
    })
    expect(buildContent({ blackout: false, kind: 'song', liveSlide })).not.toHaveProperty(
      'secondary',
    )
  })

  it('нормализация: код перевода и раскладка, мусор отбрасывается', () => {
    expect(
      normalizeProjectionSettings({ secondaryTranslation: 'KTB', parallelLayout: 'side' }),
    ).toMatchObject({ secondaryTranslation: 'KTB', parallelLayout: 'side' })
    expect(
      normalizeProjectionSettings({ secondaryTranslation: '<script>', parallelLayout: 'diagonal' }),
    ).toMatchObject({ secondaryTranslation: null, parallelLayout: 'stack' })
  })

  it('выбор переживает перезапуск', () => {
    projSettings.setParallel({ secondaryTranslation: 'KTB', parallelLayout: 'side' })
    const s = normalizeProjectionSettings(JSON.parse(JSON.stringify(projSettings.snapshot())))
    expect(s).toMatchObject({ secondaryTranslation: 'KTB', parallelLayout: 'side' })
  })
})
