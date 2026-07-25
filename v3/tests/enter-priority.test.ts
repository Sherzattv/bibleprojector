import { describe, it, expect } from 'vitest'
import { pickEnterAction } from '../src/lib/search'

/** Заглушки: логике важно лишь наличие результатов, не их содержимое */
const ref = { canonicalCode: 'JHN', chapter: 3, verse: 16, label: 'От Иоанна 3:16' }
const verse = { id: '43:3:16', ref: 'От Иоанна 3:16', text: 'Ибо так возлюбил…' }
const song = { id: 1, title: 'Благодать', songNumber: '310' }

describe('pickEnterAction — приоритет Enter в омнибоксе', () => {
  it('точная ссылка важнее всего, Enter без модификатора — превью', () => {
    const action = pickEnterAction({
      parsedRef: ref,
      verseHits: [verse],
      songHits: [song],
      withModifier: false,
    })
    expect(action).toEqual({ type: 'ref', live: false })
  })

  it('точная ссылка + Ctrl/Cmd+Enter — сразу в эфир', () => {
    const action = pickEnterAction({
      parsedRef: ref,
      verseHits: [],
      songHits: [],
      withModifier: true,
    })
    expect(action).toEqual({ type: 'ref', live: true })
  })

  it('без ссылки Enter берёт первый fuzzy-стих', () => {
    const action = pickEnterAction({
      parsedRef: null,
      verseHits: [verse],
      songHits: [song],
      withModifier: false,
    })
    expect(action).toEqual({ type: 'verse' })
  })

  it('fuzzy-стих НИКОГДА не уходит в эфир, даже с Ctrl+Enter', () => {
    const action = pickEnterAction({
      parsedRef: null,
      verseHits: [verse],
      songHits: [],
      withModifier: true,
    })
    expect(action).toEqual({ type: 'verse' })
  })

  it('без ссылки и стихов Enter открывает первую песню', () => {
    const action = pickEnterAction({
      parsedRef: null,
      verseHits: [],
      songHits: [song],
      withModifier: false,
    })
    expect(action).toEqual({ type: 'song' })
  })

  it('песня с Ctrl+Enter — тоже не эфир, просто песня', () => {
    const action = pickEnterAction({
      parsedRef: null,
      verseHits: [],
      songHits: [song],
      withModifier: true,
    })
    expect(action).toEqual({ type: 'song' })
  })

  it('пустые результаты → null (без модификатора)', () => {
    expect(
      pickEnterAction({ parsedRef: null, verseHits: [], songHits: [], withModifier: false }),
    ).toBeNull()
  })

  it('пустые результаты → null (с модификатором)', () => {
    expect(
      pickEnterAction({ parsedRef: null, verseHits: [], songHits: [], withModifier: true }),
    ).toBeNull()
  })
})
