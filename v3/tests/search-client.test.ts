import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SearchClient, type SearchTransport } from '../src/lib/search-client.svelte'
import type { SongRow } from '../src/lib/db.svelte'
import { rstDb, songs } from './fixtures'

/** Минимальные типы сообщений — без импорта search-backend (его пишет другой агент) */
interface SearchMsg {
  type: string
  seq: number
  query?: string
  translation?: string
  songs?: SongRow[]
}

interface ResultsMsg {
  type: 'results'
  seq: number
  songs: SongRow[]
  verses: unknown[]
  verseIndexReady?: boolean
}

class FakeTransport implements SearchTransport {
  sent: unknown[] = []
  onmessage: ((msg: unknown) => void) | null = null
  post(m: unknown) {
    this.sent.push(m)
  }
}

let transport: FakeTransport
let client: SearchClient

/** Ответ «из воркера» — как будто пришло сообщение назад */
function reply(msg: unknown) {
  transport.onmessage?.(msg)
}

/** Все отправленные search-сообщения */
function sentSearches(): SearchMsg[] {
  return (transport.sent as SearchMsg[]).filter((m) => m.type === 'search')
}

const verseHit = (id: string, text: string) => ({
  id,
  ref: `От Иоанна 3:${id}`,
  text,
  canonicalCode: 'JHN',
  bookId: 43,
  chapter: 3,
  verse: 1,
})

beforeEach(() => {
  vi.useFakeTimers()
  transport = new FakeTransport()
  client = new SearchClient(transport)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('начальное состояние', () => {
  it('results пустые, indexing false, ничего не отправлено', () => {
    expect(client.results).toEqual({ songs: [], verses: [] })
    expect(client.indexing).toBe(false)
    expect(transport.sent).toHaveLength(0)
  })
})

describe('debounce поиска', () => {
  it('search не постит сразу, а только после 120мс — ровно одно сообщение', () => {
    client.search('благодать', 'RST')
    expect(transport.sent).toHaveLength(0)

    vi.advanceTimersByTime(120)
    expect(transport.sent).toHaveLength(1)
    const msg = transport.sent[0] as SearchMsg
    expect(msg).toMatchObject({ type: 'search', query: 'благодать', translation: 'RST' })
    expect(typeof msg.seq).toBe('number')
  })

  it('пять быстрых search подряд схлопываются в один запрос с последним query', () => {
    const queries = ['б', 'бл', 'бла', 'благ', 'благодать']
    for (const q of queries) {
      client.search(q, 'RST')
      vi.advanceTimersByTime(50) // меньше debounce — таймер перезапускается
    }
    vi.runAllTimers()

    const searches = sentSearches()
    expect(searches).toHaveLength(1)
    expect(searches[0].query).toBe('благодать')
  })

  it('каждый отправленный search имеет возрастающий seq', () => {
    client.search('лань', 'RST')
    vi.advanceTimersByTime(120)
    client.search('никодим', 'RST')
    vi.advanceTimersByTime(120)
    client.search('благодать', 'RST')
    vi.advanceTimersByTime(120)

    const seqs = sentSearches().map((m) => m.seq)
    expect(seqs).toHaveLength(3)
    expect(seqs[1]).toBeGreaterThan(seqs[0])
    expect(seqs[2]).toBeGreaterThan(seqs[1])
  })

  it('кастомный debounceMs уважается: на 120мс тихо, на 250 — отправлено', () => {
    const slow = new SearchClient(transport, { debounceMs: 250 })
    slow.search('благодать', 'RST')

    vi.advanceTimersByTime(120)
    expect(sentSearches()).toHaveLength(0)

    vi.advanceTimersByTime(130) // итого 250
    expect(sentSearches()).toHaveLength(1)
  })
})

describe('ответы и защита от устаревших', () => {
  it('ответ с актуальным seq кладёт songs и verses в results', () => {
    client.search('благодать', 'RST')
    vi.advanceTimersByTime(120)
    const { seq } = sentSearches()[0]

    const verses = [verseHit('43:3:2', 'Ибо так возлюбил Бог мир')]
    reply({ type: 'results', seq, songs: [songs[0]], verses } satisfies ResultsMsg)

    expect(client.results.songs).toEqual([songs[0]])
    expect(client.results.verses).toEqual(verses)
  })

  it('запоздавший ответ на старый seq игнорируется — остаются данные свежего', () => {
    client.search('лань', 'RST')
    vi.advanceTimersByTime(120)
    client.search('благодать', 'RST')
    vi.advanceTimersByTime(120)

    const [a, b] = sentSearches()
    expect(b.seq).toBeGreaterThan(a.seq)

    // Сначала приходит свежий ответ (для B)
    reply({ type: 'results', seq: b.seq, songs: [songs[0]], verses: [] } satisfies ResultsMsg)
    expect(client.results.songs).toEqual([songs[0]])

    // Потом «доползает» устаревший (для A) с другими данными — его не берём
    reply({
      type: 'results',
      seq: a.seq,
      songs: [songs[2]],
      verses: [verseHit('43:3:1', 'Между фарисеями был некто')],
    } satisfies ResultsMsg)
    expect(client.results.songs).toEqual([songs[0]])
    expect(client.results.verses).toEqual([])
  })
})

describe('пустой запрос', () => {
  it('пустой query сбрасывает results сразу и не шлёт search', () => {
    client.search('благодать', 'RST')
    vi.advanceTimersByTime(120)
    reply({
      type: 'results',
      seq: sentSearches()[0].seq,
      songs: [songs[0]],
      verses: [],
    } satisfies ResultsMsg)
    expect(client.results.songs).toHaveLength(1)

    client.search('', 'RST')
    // Сразу, без ожидания debounce
    expect(client.results).toEqual({ songs: [], verses: [] })

    vi.runAllTimers()
    expect(sentSearches()).toHaveLength(1) // только первый запрос, новых нет
  })

  it('пробельный query отменяет отложенный неотправленный запрос', () => {
    client.search('благодать', 'RST')
    vi.advanceTimersByTime(50) // debounce ещё не истёк
    client.search('   ', 'RST')

    vi.runAllTimers()
    expect(sentSearches()).toHaveLength(0)
    expect(client.results).toEqual({ songs: [], verses: [] })
  })
})

describe('flush', () => {
  it('отправляет отложенный запрос немедленно, без ожидания 120мс', () => {
    client.search('благодать', 'RST')
    client.flush()
    expect(sentSearches()).toHaveLength(1)
    expect(sentSearches()[0].query).toBe('благодать')

    // Таймер не должен продублировать отправку
    vi.runAllTimers()
    expect(sentSearches()).toHaveLength(1)
  })

  it('повторный flush без отложенного запроса ничего не шлёт', () => {
    client.search('благодать', 'RST')
    client.flush()
    client.flush()
    expect(sentSearches()).toHaveLength(1)
  })
})

describe('indexing', () => {
  it('verseIndexReady:false при длинном query включает indexing, true — выключает', () => {
    client.search('благодать', 'RST')
    vi.advanceTimersByTime(120)
    reply({
      type: 'results',
      seq: sentSearches()[0].seq,
      songs: [],
      verses: [],
      verseIndexReady: false,
    } satisfies ResultsMsg)
    expect(client.indexing).toBe(true)

    client.search('благодать спасла', 'RST')
    vi.advanceTimersByTime(120)
    reply({
      type: 'results',
      seq: sentSearches()[1].seq,
      songs: [songs[0]],
      verses: [],
      verseIndexReady: true,
    } satisfies ResultsMsg)
    expect(client.indexing).toBe(false)
  })

  it('для короткого query (<3) indexing остаётся false даже при verseIndexReady:false', () => {
    client.search('бл', 'RST')
    vi.advanceTimersByTime(120)
    reply({
      type: 'results',
      seq: sentSearches()[0].seq,
      songs: [],
      verses: [],
      verseIndexReady: false,
    } satisfies ResultsMsg)
    expect(client.indexing).toBe(false)
  })
})

describe('setSongs / setBible', () => {
  it('постятся немедленно, без debounce', () => {
    client.setSongs(songs)
    expect(transport.sent).toHaveLength(1)
    expect(transport.sent[0]).toMatchObject({ type: 'set-songs', songs })

    client.setBible('RST', rstDb)
    expect(transport.sent).toHaveLength(2)
    expect(transport.sent[1]).toMatchObject({ type: 'set-bible' })
    expect(typeof (transport.sent[1] as SearchMsg).seq).toBe('number')
  })

  it('не затрагивают отложенный search в debounce-очереди', () => {
    client.search('благодать', 'RST')
    client.setSongs(songs)
    client.setBible('RST', rstDb)
    // set-* ушли сразу, search — всё ещё ждёт своего таймера
    expect(sentSearches()).toHaveLength(0)

    vi.advanceTimersByTime(120)
    const searches = sentSearches()
    expect(searches).toHaveLength(1)
    expect(searches[0].query).toBe('благодать')
  })
})
