import { describe, it, expect } from 'vitest'
import {
  createSearchBackend,
  type BackendRequest,
  type BackendResponse,
} from '../src/lib/search-backend'
import { rstDb, songs } from './fixtures'

// Ядро поискового воркера: чистый модуль без Worker API,
// протокол запрос → ответ с сохранением seq.

function search(
  backend: ReturnType<typeof createSearchBackend>,
  query: string,
  translation = 'RST',
  seq = 100,
): Extract<BackendResponse, { type: 'results' }> {
  const res = backend.handle({ seq, type: 'search', query, translation })
  expect(res.type).toBe('results')
  return res as Extract<BackendResponse, { type: 'results' }>
}

describe('createSearchBackend — протокол', () => {
  it('set-songs отвечает ready/songs с тем же seq', () => {
    const backend = createSearchBackend()
    const res = backend.handle({ seq: 7, type: 'set-songs', songs })
    expect(res).toMatchObject({ seq: 7, type: 'ready', what: 'songs' })
  })

  it('set-bible отвечает ready/bible с переводом и тем же seq', () => {
    const backend = createSearchBackend()
    const res = backend.handle({ seq: 42, type: 'set-bible', translation: 'RST', db: rstDb })
    expect(res).toMatchObject({ seq: 42, type: 'ready', what: 'bible', translation: 'RST' })
  })

  it('search возвращает results с исходными query и seq', () => {
    const backend = createSearchBackend()
    const req: BackendRequest = { seq: 13, type: 'search', query: 'возлюбил', translation: 'RST' }
    const res = backend.handle(req)
    expect(res).toMatchObject({ seq: 13, type: 'results', query: 'возлюбил' })
  })
})

describe('createSearchBackend — поиск песен', () => {
  it('до set-songs поиск песен пуст', () => {
    const backend = createSearchBackend()
    const res = search(backend, 'Благодать')
    expect(res.songs).toEqual([])
  })

  it('находит по названию после set-songs', () => {
    const backend = createSearchBackend()
    backend.handle({ seq: 1, type: 'set-songs', songs })
    const res = search(backend, 'Благодать')
    expect(res.songs[0].title).toBe('Благодать')
  })

  it('терпит опечатку («благадать»)', () => {
    const backend = createSearchBackend()
    backend.handle({ seq: 1, type: 'set-songs', songs })
    const res = search(backend, 'благадать')
    expect(res.songs.map((s) => s.title)).toContain('Благодать')
  })

  it('точный номер песни — первым результатом', () => {
    const backend = createSearchBackend()
    backend.handle({ seq: 1, type: 'set-songs', songs })
    const res = search(backend, '579')
    expect(res.songs[0].songNumber).toBe('579')
  })

  it('песни ищутся уже от 1 символа', () => {
    const backend = createSearchBackend()
    backend.handle({ seq: 1, type: 'set-songs', songs })
    // короткий запрос: стихи молчат, песни — нет
    const res = search(backend, 'ал')
    expect(res.songs.map((s) => s.title)).toContain('Аллилуйя')
    expect(res.verses).toEqual([])
  })
})

describe('createSearchBackend — поиск стихов', () => {
  it('до set-bible: verses пуст, verseIndexReady=false', () => {
    const backend = createSearchBackend()
    const res = search(backend, 'возлюбил')
    expect(res.verses).toEqual([])
    expect(res.verseIndexReady).toBe(false)
  })

  it('после set-bible находит «возлюбил», verseIndexReady=true', () => {
    const backend = createSearchBackend()
    backend.handle({ seq: 1, type: 'set-bible', translation: 'RST', db: rstDb })
    const res = search(backend, 'возлюбил')
    expect(res.verseIndexReady).toBe(true)
    expect(res.verses[0].ref).toBe('От Иоанна 3:2')
    expect(res.verses[0].text).toContain('возлюбил Бог мир')
  })

  it('другой перевод без set-bible: verses пуст, verseIndexReady=false', () => {
    const backend = createSearchBackend()
    backend.handle({ seq: 1, type: 'set-bible', translation: 'RST', db: rstDb })
    const res = search(backend, 'возлюбил', 'NRT')
    expect(res.verses).toEqual([])
    expect(res.verseIndexReady).toBe(false)
  })

  it('запрос короче 3 символов не ищет стихи', () => {
    const backend = createSearchBackend()
    backend.handle({ seq: 1, type: 'set-bible', translation: 'RST', db: rstDb })
    const res = search(backend, 'ин')
    expect(res.verses).toEqual([])
  })
})

describe('createSearchBackend — изоляция инстансов', () => {
  it('два бэкенда не делят индекс песен', () => {
    const backend1 = createSearchBackend()
    const backend2 = createSearchBackend()
    backend1.handle({ seq: 1, type: 'set-songs', songs })

    expect(search(backend1, 'Благодать').songs[0].title).toBe('Благодать')
    // backend2 песен не получал — его поиск обязан быть пустым
    expect(search(backend2, 'Благодать').songs).toEqual([])
  })

  it('два бэкенда не делят индексы стихов', () => {
    const backend1 = createSearchBackend()
    const backend2 = createSearchBackend()
    backend1.handle({ seq: 1, type: 'set-bible', translation: 'RST', db: rstDb })

    expect(search(backend1, 'возлюбил').verseIndexReady).toBe(true)
    const res2 = search(backend2, 'возлюбил')
    expect(res2.verseIndexReady).toBe(false)
    expect(res2.verses).toEqual([])
  })
})
