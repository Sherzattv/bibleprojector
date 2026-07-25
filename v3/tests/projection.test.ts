import { describe, it, expect } from 'vitest'
import { buildContent } from '../src/lib/projection'

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
