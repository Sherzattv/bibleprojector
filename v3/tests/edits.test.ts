import { describe, it, expect, beforeEach } from 'vitest'
import { EditsStore, edits, type TextStore } from '../src/lib/edits.svelte'
import { show } from '../src/lib/show.svelte'
import { data } from '../src/lib/db.svelte'
import { rstDb, nrtDb, songs } from './fixtures'

/** Фейковое хранилище: Map-обёртка под интерфейс TextStore */
function makeFakeStore(): TextStore {
  const map = new Map<string, string>()
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => {
      map.set(k, v)
    },
    remove: (k) => {
      map.delete(k)
    },
  }
}

describe('EditsStore', () => {
  let store: TextStore
  let edits2: EditsStore

  beforeEach(() => {
    store = makeFakeStore()
    edits2 = new EditsStore(store)
  })

  it('save → get возвращает сохранённый текст', () => {
    edits2.save('RST', 'JHN', 3, 2, 'Исправленный текст стиха')
    expect(edits2.get('RST', 'JHN', 3, 2)).toBe('Исправленный текст стиха')
  })

  it('без правки get возвращает null', () => {
    expect(edits2.get('RST', 'JHN', 3, 2)).toBeNull()
  })

  it('правка привязана к переводу: RST-правка не видна в NRT', () => {
    edits2.save('RST', 'JHN', 3, 2, 'Правка для RST')
    expect(edits2.get('NRT', 'JHN', 3, 2)).toBeNull()
  })

  it('правка привязана к стиху: правка 3:2 не видна для 3:1', () => {
    edits2.save('RST', 'JHN', 3, 2, 'Правка стиха 2')
    expect(edits2.get('RST', 'JHN', 3, 1)).toBeNull()
  })

  it('clear → get возвращает null', () => {
    edits2.save('RST', 'JHN', 3, 2, 'Временная правка')
    edits2.clear('RST', 'JHN', 3, 2)
    expect(edits2.get('RST', 'JHN', 3, 2)).toBeNull()
  })

  it('данные живут в переданном store: второй экземпляр видит правку первого', () => {
    edits2.save('RST', 'JHN', 3, 2, 'Общая правка')
    const another = new EditsStore(store)
    expect(another.get('RST', 'JHN', 3, 2)).toBe('Общая правка')
  })
})

describe('show.updateSlideText', () => {
  beforeEach(() => {
    edits.reset() // чистое in-memory хранилище на каждый тест
    data.bibles = { RST: rstDb, NRT: nrtDb }
    data.translation = 'RST'
    show.clear()
    show.blackout = false
  })

  it('для главы Библии меняет текст слайда и сохраняет правку', () => {
    show.loadChapter('JHN', 3, 1)
    show.updateSlideText(1, 'Отредактированный стих 3:2')

    expect(show.slides[1].text).toBe('Отредактированный стих 3:2')
    const verse = show.slides[1].verse!
    expect(edits.get(data.translation, 'JHN', 3, verse)).toBe('Отредактированный стих 3:2')
  })

  it('для песни меняет только текст слайда, правки не трогаются', () => {
    show.loadSong(songs[0])
    show.updateSlideText(0, 'Новый текст куплета')

    expect(show.slides[0].text).toBe('Новый текст куплета')
    // ничего не сохранилось в edits под координатами песни
    expect(edits.get(data.translation, 'JHN', 3, 1)).toBeNull()
  })

  it('индекс за границами — безопасен', () => {
    show.loadChapter('JHN', 3, 1)
    const before = show.slides.map((s) => s.text)
    expect(() => show.updateSlideText(99, 'мимо')).not.toThrow()
    expect(() => show.updateSlideText(-1, 'мимо')).not.toThrow()
    expect(show.slides.map((s) => s.text)).toEqual(before)
  })

  it('loadChapter применяет сохранённые правки вместо оригинала', () => {
    edits.save('RST', 'JHN', 3, 2, 'Правленый текст из хранилища')
    show.loadChapter('JHN', 3, 1)

    expect(show.slides[1].text).toBe('Правленый текст из хранилища')
    // соседний стих остаётся оригинальным
    expect(show.slides[0].text).toContain('Никодим')
  })

  it('правка другого перевода при loadChapter не применяется', () => {
    edits.save('NRT', 'JHN', 3, 2, 'Правка только для NRT')
    show.loadChapter('JHN', 3, 1)
    expect(show.slides[1].text).toContain('возлюбил')
  })
})
