import { describe, it, expect, beforeEach } from 'vitest'
import { show } from '../src/lib/show.svelte'
import { data } from '../src/lib/db.svelte'
import { rstShiftDb, nrtShiftDb, nrtShiftHighDb, songs } from './fixtures'

// Псалом 41: в RST стихи [1,2,3], в NRT — [1,3,4] (см. fixtures)
beforeEach(() => {
  data.bibles = { RST: rstShiftDb, NRT: nrtShiftDb }
  data.translation = 'RST'
  show.clear()
  show.blackout = false
})

describe('ShowSlide.verse — номер стиха на слайде', () => {
  it('слайды главы несут VerseId, а не индекс', () => {
    show.loadChapter('PSA', 41)
    expect(show.slides.map((s) => s.verse)).toEqual([1, 2, 3])
  })

  it('нумерация с пропусками сохраняется как есть', () => {
    data.translation = 'NRT'
    show.loadChapter('PSA', 41)
    expect(show.slides.map((s) => s.verse)).toEqual([1, 3, 4])
  })

  it('у слайдов песни номера стиха нет', () => {
    show.loadSong(songs[0])
    expect(show.slides[0].verse).toBeUndefined()
  })
})

describe('reloadForTranslation — перенос позиции по VerseId', () => {
  it('превью остаётся на том же стихе при другом составе стихов', () => {
    show.loadChapter('PSA', 41, 3) // стих 3 = индекс 2 в RST
    expect(show.previewIdx).toBe(2)

    data.translation = 'NRT'
    show.reloadForTranslation()

    // в NRT стих 3 — уже индекс 1
    expect(show.previewIdx).toBe(1)
    expect(show.previewSlide!.verse).toBe(3)
  })

  it('стих отсутствует в новом переводе — берётся ближайший меньший', () => {
    show.loadChapter('PSA', 41, 2) // стиха 2 в NRT нет
    data.translation = 'NRT'
    show.reloadForTranslation()
    expect(show.previewSlide!.verse).toBe(1)
    expect(show.previewIdx).toBe(0)
  })

  it('меньшего стиха нет — берётся первый', () => {
    data.bibles = { RST: rstShiftDb, NRT: nrtShiftHighDb } // NRT начинается со стиха 3
    show.loadChapter('PSA', 41, 1)
    data.translation = 'NRT'
    show.reloadForTranslation()
    expect(show.previewIdx).toBe(0)
    expect(show.previewSlide!.verse).toBe(3)
  })

  it('эфирный слайд переносится по номеру стиха', () => {
    show.loadChapter('PSA', 41, 1)
    show.takeLive(2) // в эфире стих 3 (индекс 2 в RST)
    expect(show.liveSlide!.verse).toBe(3)

    data.translation = 'NRT'
    show.reloadForTranslation()

    expect(show.liveIdx).toBe(1) // стих 3 в NRT — индекс 1
    expect(show.liveSlide!.verse).toBe(3)
  })

  it('эфир на отсутствующем стихе — ближайший меньший', () => {
    show.loadChapter('PSA', 41, 1)
    show.takeLive(1) // в эфире стих 2, в NRT его нет
    data.translation = 'NRT'
    show.reloadForTranslation()
    expect(show.liveSlide!.verse).toBe(1)
    expect(show.liveIdx).toBe(0)
  })

  it('если эфира не было, он и остаётся выключенным', () => {
    show.loadChapter('PSA', 41, 3)
    expect(show.liveIdx).toBe(-1)
    data.translation = 'NRT'
    show.reloadForTranslation()
    expect(show.liveIdx).toBe(-1)
  })
})
