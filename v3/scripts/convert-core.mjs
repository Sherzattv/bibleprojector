/**
 * Ядро конвертера данных: извлечение, чистка, валидация и манифест версий.
 * Используется scripts/convert-data.mjs; покрыто tests/convert.test.ts
 * и tests/manifest.test.ts.
 */
import { createHash } from 'node:crypto'

/**
 * Контент-хэш: sha256, первые 16 hex-символов.
 * @param {string} content
 * @returns {string}
 */
export function hashContent(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 16)
}

/**
 * Манифест версий данных для офлайн-кэша: клиент сравнивает хэши
 * и перекачивает только изменившиеся файлы.
 * @param {Record<string, string>} files — имя → содержимое
 * @returns {{version: string, files: Record<string, {hash: string, size: number}>}}
 */
export function buildManifest(files) {
  const names = Object.keys(files).sort()
  const out = {}
  for (const name of names) {
    out[name] = {
      hash: hashContent(files[name]),
      size: Buffer.byteLength(files[name], 'utf8'),
    }
  }
  const version = hashContent(names.map((n) => `${n}:${out[n].hash}`).join('\n'))
  return { version, files: out }
}

/**
 * Извлечь данные из исходника вида `window.X = {...};`.
 * Комментарии со словом «window» и последующие строки (const *_BOOK_MAP)
 * игнорируются.
 * @param {string} source — содержимое файла
 * @returns {unknown}
 */
export function parseGlobalJs(source) {
  const line = source.split('\n').find((l) => /^window\.\w+\s*=/.test(l.trim()))
  if (!line) {
    throw new Error('Не найдено присваивание window.* с данными')
  }
  let body = line.slice(line.indexOf('=') + 1).trim()
  if (body.endsWith(';')) body = body.slice(0, -1)
  return JSON.parse(body)
}

/**
 * Чистка перевода: дедупликация VerseId внутри главы (остаётся первый),
 * удаление пустых стихов. Возвращает новую базу и отчёт об аномалиях.
 * @param {{Translation: string, Books: Array}} db
 */
export function sanitizeBible(db) {
  const report = { duplicates: [], emptyVerses: [] }
  const clean = {
    ...db,
    Books: db.Books.map((book) => ({
      ...book,
      Chapters: book.Chapters.map((chapter) => {
        const seen = new Set()
        const verses = []
        for (const verse of chapter.Verses) {
          if (!verse.Text || !verse.Text.trim()) {
            report.emptyVerses.push({
              bookId: book.BookId,
              chapter: chapter.ChapterId,
              verse: verse.VerseId,
            })
            continue
          }
          if (seen.has(verse.VerseId)) {
            report.duplicates.push({
              bookId: book.BookId,
              chapter: chapter.ChapterId,
              verse: verse.VerseId,
            })
            continue
          }
          seen.add(verse.VerseId)
          verses.push(verse)
        }
        return { ...chapter, Verses: verses }
      }),
    })),
  }
  return { db: clean, report }
}

/**
 * Структурная валидация перевода. Пустой массив = всё в порядке.
 * @param {{Translation: string, Books: Array}} db
 * @returns {string[]}
 */
export function validateBible(db) {
  const problems = []
  if (db.Books.length !== 66) {
    problems.push(`${db.Translation}: книг ${db.Books.length}, ожидалось 66`)
  }
  for (const book of db.Books) {
    if (!book.Chapters.length) {
      problems.push(`${db.Translation}: книга ${book.BookId} без глав`)
      continue
    }
    for (const chapter of book.Chapters) {
      if (!chapter.Verses.length) {
        problems.push(
          `${db.Translation}: книга ${book.BookId}, глава ${chapter.ChapterId} без стихов`,
        )
      }
    }
  }
  return problems
}
