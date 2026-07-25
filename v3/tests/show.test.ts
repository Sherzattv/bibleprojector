import { describe, it, expect, beforeEach } from 'vitest'
import { show } from '../src/lib/show.svelte'
import { data } from '../src/lib/db.svelte'
import { rstDb, nrtDb, songs } from './fixtures'

beforeEach(() => {
  data.bibles = { RST: rstDb, NRT: nrtDb }
  data.translation = 'RST'
  show.clear()
  show.blackout = false
})

describe('loadChapter', () => {
  it('загружает главу как слайды со ссылками', () => {
    expect(show.loadChapter('JHN', 3, 2)).toBe(true)
    expect(show.kind).toBe('bible')
    expect(show.slides).toHaveLength(2)
    expect(show.slides[1].reference).toBe('От Иоанна 3:2')
    expect(show.previewIdx).toBe(1) // превью на запрошенном стихе
    expect(show.liveIdx).toBe(-1) // в эфир ничего не уходит само
  })

  it('false для несуществующей главы', () => {
    expect(show.loadChapter('JHN', 99)).toBe(false)
  })

  it('несуществующий стих превью — падает на первый', () => {
    show.loadChapter('JHN', 3, 99)
    expect(show.previewIdx).toBe(0)
  })
})

describe('go / навигация', () => {
  it('GO: превью уходит в эфир, превью сдвигается дальше', () => {
    show.loadChapter('JHN', 3, 1)
    show.go()
    expect(show.liveIdx).toBe(0)
    expect(show.previewIdx).toBe(1)
  })

  it('GO на последнем слайде не выходит за границу', () => {
    show.loadChapter('JHN', 3, 2)
    show.go()
    expect(show.liveIdx).toBe(1)
    expect(show.previewIdx).toBe(1)
  })

  it('GO без слайдов — безопасен', () => {
    show.slides = []
    expect(() => show.go()).not.toThrow()
  })

  it('next/prev не выходят за границы', () => {
    show.loadChapter('JHN', 3, 1)
    show.prev()
    expect(show.previewIdx).toBe(0)
    show.next()
    show.next()
    show.next()
    expect(show.previewIdx).toBe(1)
  })

  it('clear убирает эфир, blackout переключается', () => {
    show.loadChapter('JHN', 3, 1)
    show.go()
    show.clear()
    expect(show.liveSlide).toBeNull()
    show.toggleBlackout()
    expect(show.blackout).toBe(true)
  })
})

describe('смена перевода', () => {
  it('перезагружает главу в новом переводе, сохраняя позицию', () => {
    show.loadChapter('JHN', 3, 2)
    expect(show.previewSlide!.text).toContain('возлюбил')

    data.translation = 'NRT'
    show.reloadForTranslation()

    expect(show.previewSlide!.text).toContain('полюбил')
    expect(show.previewIdx).toBe(1)
    expect(show.subtitle).toBe('NRT')
  })

  it('сохраняет эфирный слайд после смены перевода', () => {
    show.loadChapter('JHN', 3, 1)
    show.go()
    data.translation = 'NRT'
    show.reloadForTranslation()
    expect(show.liveIdx).toBe(0)
  })

  it('для песни смена перевода ничего не делает', () => {
    show.loadSong(songs[0])
    const before = show.slides
    show.reloadForTranslation()
    expect(show.slides).toBe(before)
  })
})

describe('loadSong', () => {
  it('режет песню на секции по меткам', () => {
    show.loadSong(songs[0]) // Благодать: куплет + припев
    expect(show.kind).toBe('song')
    expect(show.slides).toHaveLength(2)
    expect(show.slides[0].label).toBe('Куплет 1')
    expect(show.slides[1].label).toBe('Припев')
    // метка не дублируется в тексте слайда
    expect(show.slides[0].text).not.toContain('[')
    expect(show.slides[0].reference).toBe('Благодать · № 310 · Куплет 1')
  })

  it('песня без меток — одна строфа, без номера — только название', () => {
    show.loadSong(songs[3])
    expect(show.slides).toHaveLength(1)
    expect(show.slides[0].reference).toBe('Тихая песня')
  })
})
