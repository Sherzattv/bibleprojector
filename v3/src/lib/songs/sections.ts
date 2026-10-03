/**
 * Разбиение текста песни на слайды. Чистый модуль — покрыт
 * tests/songs/sections.test.ts.
 */
import type { SongRow } from '../data/db.svelte'
import type { SongLang } from './languages'

export interface SongSection {
  /** Метка без скобок: «Куплет 1», «Припев»; пусто — у куска нет метки */
  label: string
  /** Текст секции без строки-метки */
  text: string
}

/** Строка целиком — метка секции: «[Куплет 1]» */
const LABEL_LINE = /^\[[^\]]+\]$/

/**
 * Секции песни. Метки вида [Куплет 1] начинают новый слайд; песня без меток
 * делится на строфы по пустым строкам.
 */
export function splitSongSections(text: string | null | undefined): SongSection[] {
  const raw = (text ?? '').trim()
  if (!raw) return []

  // Флаг m: ^ и $ — границы строк, а не всего текста
  if (!new RegExp(LABEL_LINE.source, 'm').test(raw)) {
    return raw
      .split(/\n\s*\n/g)
      .map((stanza) => stanza.trim())
      .filter(Boolean)
      .map((stanza) => ({ label: '', text: stanza }))
  }

  const sections: SongSection[] = []
  let label = ''
  let lines: string[] = []

  const flush = () => {
    const body = lines.join('\n').trim()
    if (label || body) sections.push({ label: label.slice(1, -1), text: body })
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (LABEL_LINE.test(trimmed)) {
      flush()
      label = trimmed
      lines = []
    } else {
      lines.push(line)
    }
  }
  flush()

  return sections
}

/**
 * Как секция называется на экране у песен не на русском: зал видит
 * подпись на языке песни. Метки в тексте и в пульте остаются русскими
 * («[Куплет 1]») — по ним оператор ориентируется в сетке слайдов.
 * Бриджа и предприпева в таблице нет: для них на экран идёт только
 * название песни, без подписи части.
 */
const SCREEN_SECTION_NAMES: Partial<
  Record<SongLang, Record<string, (n: number) => string>>
> = {
  kk: {
    Куплет: (n) => `${n}-шумақ`,
    Припев: (n) => (n > 1 ? `${n}-қайырма` : 'Қайырма'),
  },
  ky: {
    Куплет: (n) => `${n}-куплет`,
    Припев: (n) => (n > 1 ? `${n}-кайрык` : 'Кайрык'),
  },
}

/**
 * Подпись секции для экрана; пусто — песня идёт на экран без подписи
 * части. Русские песни — как в тексте: «Куплет 1».
 */
export function screenSectionLabel(label: string, lang: SongLang): string {
  const names = SCREEN_SECTION_NAMES[lang]
  if (!names || !label) return label
  const match = /^(\S+)(?:\s+(\d+))?$/.exec(label.trim())
  const name = match ? names[match[1]] : undefined
  return name ? name(Number(match![2] ?? 1)) : ''
}

/** Подпись песни без секции: «Благодать · № 310» */
export function songBaseReference(song: Pick<SongRow, 'title' | 'songNumber'>): string {
  return song.songNumber ? `${song.title} · № ${song.songNumber}` : song.title
}
