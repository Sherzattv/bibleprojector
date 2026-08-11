import { describe, it, expect } from 'vitest'
import {
  buildTranslationOptions,
  initialActive,
  statusNote,
} from '../src/lib/translation-picker'

const TRANSLATIONS: Array<[string, string]> = [
  ['RST', 'Синодальный'],
  ['NRT', 'Новый русский'],
  ['KTB', 'Қазақша'],
]

describe('buildTranslationOptions — список переводов', () => {
  it('порядок и полные имена сохраняются: в списке место есть, в доке — нет', () => {
    const options = buildTranslationOptions(TRANSLATIONS, { RST: {}, NRT: {}, KTB: {} }, {})
    expect(options.map((o) => [o.code, o.label])).toEqual([
      ['RST', 'Синодальный'],
      ['NRT', 'Новый русский'],
      ['KTB', 'Қазақша'],
    ])
  })

  it('незагруженный перевод выключен, загруженный — доступен', () => {
    const options = buildTranslationOptions(TRANSLATIONS, { RST: {} }, {})
    expect(options.map((o) => o.disabled)).toEqual([false, true, true])
  })

  it('статус загрузки доезжает до опции', () => {
    const options = buildTranslationOptions(TRANSLATIONS, { RST: {} }, {
      RST: 'ready',
      NRT: 'loading',
      KTB: 'error',
    })
    expect(options.map((o) => o.status)).toEqual(['ready', 'loading', 'error'])
  })
})

describe('statusNote — пояснение в строке списка', () => {
  it('готовый перевод не поясняем', () => {
    expect(statusNote('ready')).toBe('')
    expect(statusNote(undefined)).toBe('')
  })

  it('загрузку и ошибку называем вслух', () => {
    expect(statusNote('loading')).toBe('загрузка…')
    expect(statusNote('error')).toBe('ошибка')
  })
})

describe('initialActive — откуда начинает стрелка', () => {
  const options = buildTranslationOptions(TRANSLATIONS, { RST: {}, NRT: {}, KTB: {} }, {})

  it('список открывается на текущем переводе, а не на первом', () => {
    expect(initialActive(options, 'KTB')).toBe(2)
  })

  it('неизвестный код не выделяет ничего', () => {
    expect(initialActive(options, 'XXX')).toBe(-1)
  })
})
