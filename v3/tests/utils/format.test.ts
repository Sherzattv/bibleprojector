import { describe, it, expect } from 'vitest'
import { countLabel, formatClock, pluralRu } from '../../src/lib/utils/format'

const SHOWS = ['показ', 'показа', 'показов'] as const

describe('pluralRu / countLabel', () => {
  it.each([
    [0, 'показов'],
    [1, 'показ'],
    [2, 'показа'],
    [4, 'показа'],
    [5, 'показов'],
    [11, 'показов'],
    [12, 'показов'],
    [14, 'показов'],
    [21, 'показ'],
    [22, 'показа'],
    [111, 'показов'],
    [101, 'показ'],
  ])('%i → %s', (n, form) => {
    expect(pluralRu(n, SHOWS)).toBe(form)
  })

  it('число вместе со словом', () => {
    expect(countLabel(3, ['элемент', 'элемента', 'элементов'])).toBe('3 элемента')
  })
})

describe('formatClock', () => {
  it('часы и минуты с ведущими нулями', () => {
    expect(formatClock(new Date(2026, 0, 1, 9, 5))).toBe('09:05')
    expect(formatClock(new Date(2026, 0, 1, 23, 59).getTime())).toBe('23:59')
  })
})
