import { describe, it, expect, beforeEach } from 'vitest'
import { HistoryStore, history } from '../src/lib/history.svelte'
import type { HistoryEntry } from '../src/lib/history.svelte'
import { createMemoryStore } from '../src/lib/storage'

const bible = (verse: number): Omit<HistoryEntry, 'at'> => ({
  title: 'От Иоанна 3',
  reference: `От Иоанна 3:${verse}`,
  source: { kind: 'bible', code: 'JHN', chapter: 3, verse },
})

const song = (id: number, title: string): Omit<HistoryEntry, 'at'> => ({
  title,
  reference: title,
  source: { kind: 'song', id },
})

beforeEach(() => {
  history.reset()
})

describe('history.push — порядок и содержимое', () => {
  it('кладёт записи в начало: items[0] — самая свежая', () => {
    history.push(bible(1))
    history.push(bible(2))
    expect(history.items).toHaveLength(2)
    expect(history.items[0].reference).toBe('От Иоанна 3:2')
    expect(history.items[1].reference).toBe('От Иоанна 3:1')
  })

  it('сохраняет source как есть', () => {
    history.push(song(7, 'Благодать'))
    expect(history.items[0].source).toEqual({ kind: 'song', id: 7 })
    history.push(bible(16))
    expect(history.items[0].source).toEqual({
      kind: 'bible',
      code: 'JHN',
      chapter: 3,
      verse: 16,
    })
  })

  it('переданный at используется как есть', () => {
    history.push({ ...bible(1), at: 12345 })
    expect(history.items[0].at).toBe(12345)
  })

  it('без at — заполняется числом', () => {
    history.push(bible(1))
    expect(history.items[0].at).toBeTypeOf('number')
  })
})

describe('history.push — схлопывание дублей', () => {
  it('повторный push той же записи подряд не добавляет вторую', () => {
    history.push(bible(1))
    history.push(bible(1))
    expect(history.items).toHaveLength(1)
  })

  it('дубль определяется по title+reference', () => {
    history.push(song(1, 'Благодать'))
    history.push(song(1, 'Благодать'))
    history.push(song(1, 'Благодать'))
    expect(history.items).toHaveLength(1)
  })

  it('не-соседние дубли допустимы: A, B, A — три записи', () => {
    history.push(bible(1))
    history.push(bible(2))
    history.push(bible(1))
    expect(history.items).toHaveLength(3)
    expect(history.items[0].reference).toBe('От Иоанна 3:1')
    expect(history.items[1].reference).toBe('От Иоанна 3:2')
  })
})

describe('history — ёмкость и очистка', () => {
  it('держит не больше 50 записей, старые выбрасываются', () => {
    for (let v = 1; v <= 55; v++) history.push(bible(v))
    expect(history.items).toHaveLength(50)
    // самая свежая — последний push, самая старая (55-50=5 выброшено) — стих 6
    expect(history.items[0].reference).toBe('От Иоанна 3:55')
    expect(history.items[49].reference).toBe('От Иоанна 3:6')
  })

  it('clear очищает историю', () => {
    history.push(bible(1))
    history.push(bible(2))
    history.clear()
    expect(history.items).toHaveLength(0)
  })

  it('восстанавливает историю после создания нового store', () => {
    const store = createMemoryStore()
    const first = new HistoryStore(store)
    first.push({ ...bible(16), at: 123 })
    const restored = new HistoryStore(store)
    expect(restored.items).toEqual([{ ...bible(16), at: 123 }])
  })
})
