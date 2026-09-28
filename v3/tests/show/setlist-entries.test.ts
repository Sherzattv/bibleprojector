import { describe, it, expect } from 'vitest'
import { MAX_ITEMS, normalizeEntry, parseEntries } from '../../src/lib/show/setlist-entries'

describe('normalizeEntry', () => {
  it('принимает валидные пункты всех видов', () => {
    expect(normalizeEntry({ kind: 'song', id: 5, title: ' Песня ' })).toEqual({
      kind: 'song',
      id: 5,
      title: 'Песня',
    })
    expect(normalizeEntry({ kind: 'bible', code: 'JHN', chapter: '3', verse: 16, title: 'Ин 3:16' })).toEqual({
      kind: 'bible',
      code: 'JHN',
      chapter: 3,
      verse: 16,
      title: 'Ин 3:16',
    })
    expect(normalizeEntry({ kind: 'note', title: 'Объявления' })).toEqual({
      kind: 'note',
      title: 'Объявления',
      text: '',
    })
  })

  it('без заголовка или с неверными номерами — null', () => {
    expect(normalizeEntry({ kind: 'song', id: 5, title: '  ' })).toBeNull()
    expect(normalizeEntry({ kind: 'bible', code: 'JHN', chapter: 0, verse: 1, title: 'x' })).toBeNull()
    expect(normalizeEntry({ kind: 'song', id: -1, title: 'x' })).toBeNull()
    expect(normalizeEntry('мусор')).toBeNull()
  })

  it('фон пункта сохраняется, только если он из каталога', () => {
    const song = { kind: 'song', id: 1, title: 'x' }
    expect(normalizeEntry({ ...song, background: { preset: 'black', palette: 'midnight' } })).toEqual({
      ...song,
      background: { preset: 'black', palette: 'midnight' },
    })
    expect(normalizeEntry({ ...song, background: { preset: 'нет-такого', palette: 'midnight' } })).toEqual(song)
  })
})

describe('parseEntries', () => {
  it('понимает и массив, и файл экспорта { version, items }', () => {
    const item = { kind: 'note', title: 'a', text: 'b' }
    expect(parseEntries(JSON.stringify([item]))).toEqual([item])
    expect(parseEntries(JSON.stringify({ version: 1, items: [item] }))).toEqual([item])
  })

  it('мигрирует формат v2 с payload', () => {
    const v2 = [
      { kind: 'verse', title: 'Ин 3:16-18', payload: { type: 'verse', canonicalCode: 'JHN', chapter: '3', verse: '16-18' } },
      { kind: 'song', title: 'Благодать', payload: { type: 'song', id: 1 } },
    ]
    expect(parseEntries(JSON.stringify(v2), true)).toEqual([
      { kind: 'bible', code: 'JHN', chapter: 3, verse: 16, title: 'Ин 3:16-18' },
      { kind: 'song', id: 1, title: 'Благодать' },
    ])
  })

  it('битые пункты выбрасываются, длина ограничена', () => {
    const many = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({ kind: 'note', title: `n${i}`, text: '' }))
    expect(parseEntries(JSON.stringify([...many, { kind: '???' }]))).toHaveLength(MAX_ITEMS)
  })

  it('не JSON или не список — null', () => {
    expect(parseEntries('{обрыв')).toBeNull()
    expect(parseEntries('{"items": 5}')).toBeNull()
  })
})
