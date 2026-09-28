import { describe, it, expect } from 'vitest'
import { foldText, stripMarkup } from '../../src/lib/utils/text'

describe('stripMarkup', () => {
  it('убирает теги, оставляя видимый текст', () => {
    expect(stripMarkup('<J>Я есмь</J> путь')).toBe('Я есмь путь')
  })

  it('текст без разметки не меняет', () => {
    expect(stripMarkup('В начале было Слово')).toBe('В начале было Слово')
  })
})

describe('foldText', () => {
  it('сравнивает без регистра и «ё»', () => {
    expect(foldText('Ёлка ЁЖ')).toBe('елка еж')
  })
})
