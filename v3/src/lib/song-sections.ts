/**
 * Разбиение текста песни на слайды. Чистый модуль — покрыт
 * tests/song-sections.test.ts.
 */
import type { SongRow } from './db.svelte'

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

/** Подпись песни без секции: «Благодать · № 310» */
export function songBaseReference(song: Pick<SongRow, 'title' | 'songNumber'>): string {
  return song.songNumber ? `${song.title} · № ${song.songNumber}` : song.title
}
