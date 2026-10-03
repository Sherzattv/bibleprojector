import { describe, it, expect } from 'vitest'
import { statusNote, withStatusNote } from '../../src/lib/ui/load-status'

describe('statusNote — пояснение в строке списка', () => {
  it('готовую базу не поясняем', () => {
    expect(statusNote('ready')).toBe('')
    expect(statusNote(undefined)).toBe('')
  })

  it('загрузку и ошибку называем вслух', () => {
    expect(statusNote('loading')).toBe('загрузка…')
    expect(statusNote('error')).toBe('ошибка')
  })
})

describe('withStatusNote — подсказка переключателя', () => {
  it('готовая база — подсказка как есть', () => {
    expect(withStatusNote('KTB · Қазақша', 'ready')).toBe('KTB · Қазақша')
    expect(withStatusNote('Песни: Кыргызча')).toBe('Песни: Кыргызча')
  })

  it('загрузка и ошибка дописываются через тире', () => {
    expect(withStatusNote('KTB · Қазақша', 'loading')).toBe('KTB · Қазақша — загрузка…')
    expect(withStatusNote('Песни: Қазақша', 'error')).toBe('Песни: Қазақша — ошибка')
  })
})
