import { describe, it, expect } from 'vitest'
import { asRecord, createMemoryStore, readJson, writeJson } from '../../src/lib/utils/storage'

describe('readJson / writeJson', () => {
  it('записанное читается обратно', () => {
    const store = createMemoryStore()
    writeJson(store, 'k', { a: 1, list: ['x'] })
    expect(readJson(store, 'k')).toEqual({ a: 1, list: ['x'] })
  })

  it('нет ключа — null', () => {
    expect(readJson(createMemoryStore(), 'k')).toBeNull()
  })

  it('мусор в хранилище — null, без исключения', () => {
    expect(readJson(createMemoryStore({ k: '{обрыв' }), 'k')).toBeNull()
  })
})

describe('asRecord', () => {
  it('объект возвращается как есть', () => {
    const value = { a: 1 }
    expect(asRecord(value)).toBe(value)
  })

  it.each([null, undefined, 42, 'строка', [1, 2]])('%j — пустой объект', (value) => {
    expect(asRecord(value)).toEqual({})
  })
})
