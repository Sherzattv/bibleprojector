import { describe, it, expect } from 'vitest'
import { parseQuery, resolveReference } from '../src/lib/bible/reference'

describe('parseQuery — ссылки на стихи', () => {
  it('понимает «ин 3 16»', () => {
    expect(parseQuery('ин 3 16')).toEqual({
      canonicalCode: 'JHN',
      bookName: 'ин',
      chapter: '3',
      verse: '16',
    })
  })

  it('понимает двоеточие и диапазон «мф 5:3-10»', () => {
    expect(parseQuery('мф 5:3-10')).toMatchObject({ canonicalCode: 'MAT', chapter: '5', verse: '3-10' })
  })

  it('понимает книги с номером «1 кор 13 4»', () => {
    expect(parseQuery('1 кор 13 4')).toMatchObject({ canonicalCode: '1CO', chapter: '13', verse: '4' })
  })

  it('понимает казахские сокращения «жар 1:1»', () => {
    expect(parseQuery('жар 1:1')).toMatchObject({ canonicalCode: 'GEN' })
  })

  it('без стиха — первый стих главы', () => {
    expect(parseQuery('пс 22')).toMatchObject({ canonicalCode: 'PSA', chapter: '22', verse: '1' })
  })

  it('регистр и лишние пробелы не мешают', () => {
    expect(parseQuery('  ИН   3 :  16 ')).toMatchObject({ canonicalCode: 'JHN', chapter: '3', verse: '16' })
  })

  it('возвращает null на мусор и незнакомую книгу', () => {
    expect(parseQuery('просто текст без цифр')).toBeNull()
    expect(parseQuery('579')).toBeNull()
    expect(parseQuery('xyz 1 1')).toBeNull()
  })
})

describe('resolveReference — ссылка, готовая к открытию', () => {
  it('подпись на языке перевода, стих — числом', () => {
    expect(resolveReference('ин 3 16', 'RST')).toEqual({
      canonicalCode: 'JHN',
      chapter: 3,
      verse: 16,
      label: 'От Иоанна 3:16',
    })
    expect(resolveReference('ин 3 16', 'KTB')?.label).toBe('Жохан 3:16')
  })

  it('диапазон и перечисление открываются с первого стиха', () => {
    expect(resolveReference('мф 5:3-10', 'RST')).toMatchObject({ verse: 3, label: 'От Матфея 5:3-10' })
    expect(resolveReference('рим 8 28,31', 'RST')).toMatchObject({ verse: 28 })
  })

  it('не ссылка — null', () => {
    expect(resolveReference('благодать', 'RST')).toBeNull()
  })
})
