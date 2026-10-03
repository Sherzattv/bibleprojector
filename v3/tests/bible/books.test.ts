import { describe, it, expect } from 'vitest'
import {
  BOOKS,
  bookLanguage,
  bookTitleIn,
  codeForBookId,
  findBookInfo,
  getBookId,
  getBookTitle,
  getCanonicalCode,
} from '../../src/lib/bible/books'
import { findBook, findChapter } from '../../src/lib/bible/chapters'
import { rstDb } from '../fixtures'

const TRANSLATIONS = ['RST', 'NRT', 'KTB', 'KYB']

describe('каталог книг', () => {
  it('66 книг с уникальными кодами', () => {
    expect(BOOKS).toHaveLength(66)
    expect(new Set(BOOKS.map((b) => b.code)).size).toBe(66)
  })

  it('findBookInfo — по коду, неизвестный код — null', () => {
    expect(findBookInfo('JHN')?.ru).toBe('От Иоанна')
    expect(findBookInfo('XXX')).toBeNull()
  })
})

describe('BookId переводов', () => {
  it('RST, NRT и KYB — канонический порядок', () => {
    for (const t of ['RST', 'NRT', 'KYB']) {
      expect(getBookId('GEN', t)).toBe(1)
      expect(getBookId('ROM', t)).toBe(45)
      expect(getBookId('JAS', t)).toBe(59)
      expect(getBookId('REV', t)).toBe(66)
    }
  })

  it('KTB: соборные послания стоят перед посланиями Павла', () => {
    expect(getBookId('ACT', 'KTB')).toBe(44)
    expect(getBookId('JAS', 'KTB')).toBe(45)
    expect(getBookId('JUD', 'KTB')).toBe(51)
    expect(getBookId('ROM', 'KTB')).toBe(52)
    expect(getBookId('HEB', 'KTB')).toBe(65)
    expect(getBookId('REV', 'KTB')).toBe(66)
  })

  it('в каждом переводе BookId — перестановка 1..66', () => {
    for (const t of TRANSLATIONS) {
      const ids = BOOKS.map((b) => getBookId(b.code, t)).sort((a, b) => a! - b!)
      expect(ids).toEqual(Array.from({ length: 66 }, (_, i) => i + 1))
    }
  })

  it('codeForBookId — обратная карта согласована с прямой', () => {
    for (const t of TRANSLATIONS) {
      for (const { code } of BOOKS) expect(codeForBookId(t, getBookId(code, t)!)).toBe(code)
    }
  })

  it('неизвестные перевод, книга или BookId — null', () => {
    expect(getBookId('JHN', 'XXX')).toBeNull()
    expect(getBookId('XXX', 'RST')).toBeNull()
    expect(codeForBookId('RST', 99999)).toBeNull()
    expect(codeForBookId('XXX', 1)).toBeNull()
  })
})

describe('названия книг', () => {
  it('язык названий определяется переводом', () => {
    expect(bookLanguage('RST')).toBe('ru')
    expect(bookLanguage('NRT')).toBe('ru')
    expect(bookLanguage('KTB')).toBe('kz')
    expect(bookLanguage('KYB')).toBe('ky')
  })

  it('bookTitleIn — название так, как его пишет перевод', () => {
    expect(bookTitleIn('GEN', 'RST')).toBe('Бытие')
    expect(bookTitleIn('GEN', 'KTB')).toBe('Жаратылыс')
    expect(bookTitleIn('GEN', 'KYB')).toBe('Башталыш')
  })

  it('KYB — названия как в тексте киргизской Библии', () => {
    expect(bookTitleIn('EXO', 'KYB')).toBe('Мисирден чыгуу')
    expect(bookTitleIn('JOS', 'KYB')).toBe('Жашыя')
    expect(bookTitleIn('1SA', 'KYB')).toBe('1 Шемуел')
    expect(bookTitleIn('PHM', 'KYB')).toBe('Филемонго')
    expect(bookTitleIn('HEB', 'KYB')).toBe('Эврейлерге')
    expect(bookTitleIn('JUD', 'KYB')).toBe('Жүйүт')
  })

  it('неизвестный код — «Библия»', () => {
    expect(getBookTitle('XXX')).toBe('Библия')
  })
})

describe('getCanonicalCode — книга по вводу оператора', () => {
  it('русские сокращения и полные имена', () => {
    expect(getCanonicalCode('ин')).toBe('JHN')
    expect(getCanonicalCode('римлянам')).toBe('ROM')
    expect(getCanonicalCode('1 кор')).toBe('1CO')
  })

  it('короткие казахские и киргизские сокращения', () => {
    expect(getCanonicalCode('жар')).toBe('GEN')
    expect(getCanonicalCode('баш')).toBe('GEN')
    expect(getCanonicalCode('заб')).toBe('PSA')
  })

  it('показанное на экране название вводится обратно', () => {
    for (const b of BOOKS) {
      expect(getCanonicalCode(b.ru)).toBe(b.code)
    }
    expect(getCanonicalCode('1-е Коринфянам')).toBe('1CO')
  })

  it('киргизские названия вводятся обратно, прежние тоже узнаются', () => {
    for (const b of BOOKS) {
      expect(getCanonicalCode(b.ky)).toBe(b.code)
    }
    expect(getCanonicalCode('жошуа')).toBe('JOS')
    expect(getCanonicalCode('1 самуел')).toBe('1SA')
    expect(getCanonicalCode('жөөттөргө')).toBe('HEB')
  })

  it('регистр, пробелы и дефисы не важны', () => {
    expect(getCanonicalCode('ОТ МАТФЕЯ')).toBe('MAT')
    expect(getCanonicalCode(' Ин ')).toBe('JHN')
  })

  it('незнакомый ввод — null', () => {
    expect(getCanonicalCode('xyz')).toBeNull()
    expect(getCanonicalCode('')).toBeNull()
  })
})

describe('findBook / findChapter', () => {
  it('находит главу по коду книги', () => {
    expect(findChapter(rstDb, 'JHN', 'RST', 3)?.Verses).toHaveLength(2)
  })

  it('нет книги или главы — null', () => {
    expect(findBook(rstDb, 'GEN', 'RST')).toBeNull()
    expect(findChapter(rstDb, 'JHN', 'RST', 99)).toBeNull()
    expect(findChapter(rstDb, 'JHN', 'XXX', 3)).toBeNull()
  })
})
