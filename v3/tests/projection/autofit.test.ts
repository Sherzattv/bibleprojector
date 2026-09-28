import { describe, it, expect } from 'vitest'
// Модуль autofit ещё не реализован — тесты красные до реализации (TDD)
import { autofitScale } from '../src/lib/autofit'

/** Строка из n псевдослучайных, но детерминированных «слов» */
const longLine = (n: number) => 'слово '.repeat(Math.ceil(n / 6)).slice(0, n)

describe('autofitScale — автоподбор масштаба шрифта проекции', () => {
  it('короткий текст показывается в полный размер (ровно 1)', () => {
    expect(autofitScale('Ибо так возлюбил Бог мир')).toBe(1)
  })

  it('короткий многострочный текст (до 6 строк) — тоже 1', () => {
    expect(autofitScale('Первая строка\nВторая строка\nТретья строка')).toBe(1)
  })

  it('пустая строка → 1', () => {
    expect(autofitScale('')).toBe(1)
  })

  it('результат всегда в диапазоне [0.4, 1]', () => {
    const samples = [
      '',
      'а',
      longLine(200),
      longLine(1200),
      longLine(10000),
      Array(50).fill('строка припева').join('\n'),
    ]
    for (const t of samples) {
      const s = autofitScale(t)
      expect(s).toBeGreaterThanOrEqual(0.4)
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('монотонность: добавление текста не увеличивает масштаб', () => {
    const tail = ' и ещё немного текста в конец'
    const pairs = [
      longLine(100),
      longLine(300),
      longLine(900),
      'Куплет один\nКуплет два\nКуплет три\n' + longLine(150),
    ]
    for (const t of pairs) {
      expect(autofitScale(t)).toBeGreaterThanOrEqual(autofitScale(t + tail))
    }
  })

  it('1200 символов одной строкой — заметное уменьшение (< 0.7)', () => {
    expect(autofitScale(longLine(1200))).toBeLessThan(0.7)
  })

  it('3000 символов упираются в нижний предел (ровно 0.4)', () => {
    expect(autofitScale(longLine(3000))).toBe(0.4)
  })

  it('много коротких строк давит отдельно: 20 строк по 5 символов → < 1', () => {
    const text = Array(20).fill('пять!').join('\n')
    expect(text.length).toBeLessThan(160) // сумма символов сама по себе «короткая»
    expect(autofitScale(text)).toBeLessThan(1)
  })
})
