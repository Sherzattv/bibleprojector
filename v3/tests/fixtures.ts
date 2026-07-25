/** Мини-базы для тестов: Иоанна 3 (2 стиха) + Псалтирь 41 в RST и NRT */
// @ts-expect-error legacy JS module without types
import { getBookId } from '../src/lib/legacy/canonical.js'
import type { BibleDb, SongRow } from '../src/lib/db.svelte'

function makeDb(translation: string, texts: Record<string, string[]>): BibleDb {
  return {
    Translation: translation,
    Books: Object.entries(texts).map(([code, verses]) => ({
      BookId: getBookId(code, translation) as number,
      Chapters: [
        {
          ChapterId: 3,
          Verses: verses.map((Text, i) => ({ VerseId: i + 1, Text })),
        },
      ],
    })),
  }
}

export const rstDb = makeDb('RST', {
  JHN: [
    'Между фарисеями был некто, именем Никодим.',
    'Ибо так возлюбил Бог мир, что отдал Сына Своего Единородного.',
  ],
  PSA: ['Как лань желает к потокам воды.', 'Жаждет душа моя к Богу крепкому.'],
})

export const nrtDb = makeDb('NRT', {
  JHN: [
    'Среди фарисеев был один по имени Никодим.',
    'Ведь Бог так полюбил этот мир, что отдал Своего единственного Сына.',
  ],
})

export const songs: SongRow[] = [
  {
    id: 1,
    title: 'Благодать',
    songNumber: '310',
    text: '[Куплет 1]\nБлагодать спасла меня\n\n[Припев]\nПой аллилуйя',
  },
  { id: 2, title: '1000 рук', songNumber: '579', text: 'Слышу пенье цветов\nИ росы перелив' },
  { id: 3, title: 'Аллилуйя', songNumber: '156', text: 'Аллилуйя, аллилуйя' },
  // песня без секций и без номера
  { id: 4, title: 'Тихая песня', text: 'Строка один\nСтрока два' },
]
