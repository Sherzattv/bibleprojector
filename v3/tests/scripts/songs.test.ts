import { describe, it, expect } from 'vitest'
import {
  isJunkSong,
  isJunkText,
  sanitizeSongs,
  lyricsToText,
  namespaceSongs,
  songFromRow,
  songsFromRows,
  validateSongs,
  // @ts-expect-error Node ESM helper written in JavaScript without declarations.
} from '../../scripts/songs-core.mjs'

const xml = (...verses: string[]) =>
  `<?xml version='1.0' encoding='UTF-8'?><song version="1.0"><lyrics>${verses.join('')}</lyrics></song>`
const verse = (type: string, label: string, body: string) =>
  `<verse label="${label}" type="${type}"><![CDATA[${body}]]></verse>`

describe('lyricsToText — текст песни из OpenLP-XML', () => {
  it('секции получают метки, которые понимает разбивка на слайды', () => {
    const text = lyricsToText(
      xml(verse('v', '1', 'Иса - Ұлы Патша\nОртамызға келші.'), verse('c', '1', 'Құдайды мадақтаймыз біз')),
    )
    expect(text).toBe('[Куплет 1]\nИса - Ұлы Патша\nОртамызға келші.\n\n[Припев 1]\nҚұдайды мадақтаймыз біз')
  })

  it('бридж и предприпев', () => {
    const text = lyricsToText(xml(verse('b', '1', 'а'), verse('p', '2', 'б')))
    expect(text).toBe('[Бридж 1]\nа\n\n[Предприпев 2]\nб')
  })

  it('пустые секции и пустые края строк выбрасываются', () => {
    const text = lyricsToText(xml(verse('v', '1', '\n\nСтрока  \n\n'), verse('v', '2', '  \n ')))
    expect(text).toBe('[Куплет 1]\nСтрока')
  })

  it('текст без CDATA: сущности раскодируются', () => {
    const text = lyricsToText(xml('<verse label="1" type="v">Хлеб &amp; вино &#171;да&#187;</verse>'))
    expect(text).toBe('[Куплет 1]\nХлеб & вино «да»')
  })

  it('теги форматирования OpenLP убираются', () => {
    expect(lyricsToText(xml(verse('v', '1', '{st}Свят{/st} Господь')))).toBe('[Куплет 1]\nСвят Господь')
  })
})

describe('isJunkText — пустышки без текста', () => {
  it('нет текста или только аккорды — пустышка', () => {
    expect(isJunkText('')).toBe(true)
    expect(isJunkText('[Куплет 1]\nD F#m Bm G A/C#')).toBe(true)
  })

  it('короткая детская песня — не пустышка', () => {
    expect(isJunkText('[Куплет 1]\nТырс-тырс, тырс-тырс, Жаңбыр жауып тұр.')).toBe(false)
  })
})

describe('isJunkSong / sanitizeSongs — заглушки в готовой базе', () => {
  it('«за текстом обращаться на почту» вместо текста — заглушка', () => {
    expect(
      isJunkSong({ title: 'Вечеря', text: '[Куплет 1]\nЗа текстом обращаться на почту a-lec@ukr.net' }),
    ).toBe(true)
  })

  it('та же строка над настоящим текстом — песня остаётся', () => {
    const text =
      '[Куплет 1]\nЗа текстом обращаться на почту a-lec@ukr.net\nСтучит дождь в оконное стекло, на сердце уныние'
    expect(isJunkSong({ title: 'Стучит Дождь', text })).toBe(false)
  })

  it('«(нет слов)» в названии — заглушка, «нет слов» в тексте — нет', () => {
    expect(isJunkSong({ title: 'В бою ( нет слов)', text: 'Отец, мне так было трудно' })).toBe(true)
    expect(
      isJunkSong({ title: 'Тебя лишь славить хочу я', text: 'Больше нет слов у меня, кроме как славить Тебя' }),
    ).toBe(false)
  })

  it('sanitizeSongs отдаёт оставшиеся и выброшенные', () => {
    const real = { id: 1, title: 'Благодать', text: 'Благодать спасла меня, пой аллилуйя' }
    const stub = { id: 2, title: 'Верю я', text: 'Верю я' }
    expect(sanitizeSongs([real, stub])).toEqual({ songs: [real], dropped: [stub] })
  })
})

describe('songFromRow / songsFromRows', () => {
  const row = (id: number, title: string, body = 'Достаточно длинная строка песни') => ({
    id,
    title,
    alternate_title: '',
    lyrics: xml(verse('v', '1', body)),
    song_number: id === 1 ? '421' : null,
    copyright: '',
  })

  it('поля песни: номер строкой, пустые поля не пишутся', () => {
    expect(songFromRow(row(1, '  Шаттык,  шаттык '))).toEqual({
      id: 1,
      title: 'Шаттык, шаттык',
      text: '[Куплет 1]\nДостаточно длинная строка песни',
      songNumber: '421',
    })
  })

  it('пустышки отбрасываются и считаются', () => {
    const { songs, dropped } = songsFromRows([row(1, 'Песня'), row(2, 'Минусовка', '')], 'kk')
    expect(songs.map((s: { id: number }) => s.id)).toEqual([1])
    expect(dropped).toBe(1)
  })

  it('сортировка по правилам языка: Ә рядом с А, кавычки не мешают', () => {
    const { songs } = songsFromRows(
      [row(1, 'Бала'), row(2, 'Әке'), row(3, '«Болсын!»'), row(4, 'Ата')],
      'kk',
    )
    expect(songs.map((s: { title: string }) => s.title)).toEqual(['Ата', 'Әке', 'Бала', '«Болсын!»'])
  })
})

describe('namespaceSongs / validateSongs', () => {
  it('русские id не меняются, казахские сдвигаются в своё пространство', () => {
    const songs = [{ id: 5, title: 'А', text: 'т' }]
    expect(namespaceSongs(songs, 'ru')[0].id).toBe(5)
    expect(namespaceSongs(songs, 'kk')[0].id).toBe(1_000_005)
    expect(namespaceSongs(songs, 'ky')[0].id).toBe(2_000_005)
  })

  it('валидная база — без проблем', () => {
    expect(validateSongs([{ id: 1_000_001, title: 'А', text: 'т' }], 'kk')).toEqual([])
  })

  it('id чужого языка, повтор id, пустое название — проблемы', () => {
    const problems = validateSongs(
      [
        { id: 5, title: 'А', text: 'т' },
        { id: 1_000_001, title: 'Б', text: 'т' },
        { id: 1_000_001, title: ' ', text: 'т' },
      ],
      'kk',
    )
    expect(problems).toHaveLength(3)
  })

  it('пустая база — проблема', () => {
    expect(validateSongs([], 'ky')).toHaveLength(1)
  })
})
