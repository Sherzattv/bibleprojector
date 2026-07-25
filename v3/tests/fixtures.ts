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

/** Глава с явными VerseId — для тестов переноса позиции по номеру стиха */
function makeChapterDb(
  translation: string,
  code: string,
  chapter: number,
  verses: Array<[verseId: number, text: string]>,
): BibleDb {
  return {
    Translation: translation,
    Books: [
      {
        BookId: getBookId(code, translation) as number,
        Chapters: [
          {
            ChapterId: chapter,
            Verses: verses.map(([VerseId, Text]) => ({ VerseId, Text })),
          },
        ],
      },
    ],
  }
}

/** Псалом 41: в RST стихи 1,2,3 — в NRT состав другой: 1,3,4 */
export const rstShiftDb = makeChapterDb('RST', 'PSA', 41, [
  [1, 'Начальнику хора. Учение. Сынов Кореевых.'],
  [2, 'Как лань желает к потокам воды.'],
  [3, 'Жаждет душа моя к Богу крепкому, живому.'],
])

export const nrtShiftDb = makeChapterDb('NRT', 'PSA', 41, [
  [1, 'Дирижёру хора. Наставление потомков Кораха.'],
  [3, 'Как стремится лань к потокам воды.'],
  [4, 'Жаждет душа моя Бога, живого Бога.'],
])

/** Вариант NRT без младших стихов — «ближайшего меньшего» не существует */
export const nrtShiftHighDb = makeChapterDb('NRT', 'PSA', 41, [
  [3, 'Как стремится лань к потокам воды.'],
  [4, 'Жаждет душа моя Бога, живого Бога.'],
])

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

/** Две разные песни с ОДИНАКОВЫМ номером 214 — различимы только по id */
export const songsDuo214: SongRow[] = [
  { id: 5, title: 'Как лань желает', songNumber: '214', text: 'Как лань желает к потокам' },
  { id: 6, title: 'Как лань желает (новая)', songNumber: '214', text: 'Совсем другой текст песни' },
]
