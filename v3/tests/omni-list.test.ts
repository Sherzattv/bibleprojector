import { describe, it, expect } from 'vitest'
// Модуль omni-list ещё не реализован — тесты красные до реализации (TDD)
import { buildOptions, nextIndex, pickActionAt, type OmniOption } from '../src/lib/omni-list'

describe('buildOptions — плоский список опций выпадашки', () => {
  it('порядок: ссылка, потом стихи, потом песни', () => {
    expect(buildOptions(true, 2, 1)).toEqual([
      { kind: 'ref' },
      { kind: 'verse', index: 0 },
      { kind: 'verse', index: 1 },
      { kind: 'song', index: 0 },
    ])
  })

  it('без ссылки список начинается со стихов', () => {
    expect(buildOptions(false, 1, 2)).toEqual([
      { kind: 'verse', index: 0 },
      { kind: 'song', index: 0 },
      { kind: 'song', index: 1 },
    ])
  })

  it('только ссылка — единственная опция', () => {
    expect(buildOptions(true, 0, 0)).toEqual([{ kind: 'ref' }])
  })

  it('пустые результаты → пустой список', () => {
    expect(buildOptions(false, 0, 0)).toEqual([])
  })
})

describe('nextIndex — циклическая навигация стрелками', () => {
  it('шаг вниз двигает на следующую опцию', () => {
    expect(nextIndex(4, 0, 1)).toBe(1)
  })

  it('вниз с последней опции — по кругу на первую', () => {
    expect(nextIndex(4, 3, 1)).toBe(0)
  })

  it('вверх с первой опции — по кругу на последнюю', () => {
    expect(nextIndex(4, 0, -1)).toBe(3)
  })

  it('ничего не выбрано (current -1): вниз выбирает первую', () => {
    expect(nextIndex(4, -1, 1)).toBe(0)
  })

  it('ничего не выбрано (current -1): вверх выбирает последнюю', () => {
    expect(nextIndex(4, -1, -1)).toBe(3)
  })

  it('пустой список → всегда -1', () => {
    expect(nextIndex(0, -1, 1)).toBe(-1)
    expect(nextIndex(0, -1, -1)).toBe(-1)
    expect(nextIndex(0, 0, 1)).toBe(-1)
  })
})

describe('pickActionAt — действие Enter для активной опции', () => {
  const full: OmniOption[] = [
    { kind: 'ref' },
    { kind: 'verse', index: 0 },
    { kind: 'verse', index: 1 },
    { kind: 'song', index: 0 },
  ]

  it('активна ссылка, без модификатора — превью', () => {
    expect(pickActionAt(full, 0, false)).toEqual({ type: 'ref', live: false })
  })

  it('активна ссылка + Ctrl/Cmd — сразу в эфир', () => {
    expect(pickActionAt(full, 0, true)).toEqual({ type: 'ref', live: true })
  })

  it('активен стих — открывает именно его по индексу', () => {
    expect(pickActionAt(full, 2, false)).toEqual({ type: 'verse', index: 1 })
  })

  it('активна песня — открывает её по индексу', () => {
    expect(pickActionAt(full, 3, false)).toEqual({ type: 'song', index: 0 })
  })

  it('fuzzy-стих НИКОГДА не уходит в эфир, даже с модификатором', () => {
    expect(pickActionAt(full, 1, true)).toEqual({ type: 'verse', index: 0 })
  })

  it('песня с модификатором — тоже без эфира, просто песня', () => {
    expect(pickActionAt(full, 3, true)).toEqual({ type: 'song', index: 0 })
  })

  it('ничего не выбрано (-1) → действие для первой опции по приоритету', () => {
    expect(pickActionAt(full, -1, false)).toEqual({ type: 'ref', live: false })
    const noRef: OmniOption[] = [{ kind: 'verse', index: 0 }, { kind: 'song', index: 0 }]
    expect(pickActionAt(noRef, -1, false)).toEqual({ type: 'verse', index: 0 })
  })

  it('индекс вне границ → тоже первая опция', () => {
    expect(pickActionAt(full, 99, false)).toEqual({ type: 'ref', live: false })
  })

  it('пустой список → null', () => {
    expect(pickActionAt([], -1, false)).toBeNull()
    expect(pickActionAt([], -1, true)).toBeNull()
  })
})
