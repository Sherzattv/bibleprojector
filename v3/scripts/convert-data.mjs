/**
 * Конвертирует существующие базы (app/js/data/*.js, глобальные window.*)
 * в чистый JSON для v3:
 *   public/data/{rst,nrt,ktb,kyb,songs}.json — полные данные (gitignored)
 *   src/lib/demo-data.json — срез для демо-сборки одним файлом (gitignored)
 * Данные проходят чистку (дубли VerseId, пустые стихи) и валидацию.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseGlobalJs, sanitizeBible, validateBible } from './convert-core.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const dataDir = join(repo, 'app', 'js', 'data')
const outDir = join(here, '..', 'public', 'data')
mkdirSync(outDir, { recursive: true })

const { TRANSLATION_MAPS } = await import(
  join(repo, 'app', 'js', 'modules', 'canonical.js')
)

const translations = {
  RST: 'bible_data.js',
  NRT: 'nrt_data.js',
  KTB: 'ktb_data.js',
  KYB: 'kyb_data.js',
}

let hasProblems = false
const full = {}
for (const [code, file] of Object.entries(translations)) {
  const raw = parseGlobalJs(readFileSync(join(dataDir, file), 'utf8'))
  const { db, report } = sanitizeBible(raw)
  const problems = validateBible(db)

  full[code] = db
  writeFileSync(join(outDir, `${code.toLowerCase()}.json`), JSON.stringify(db))

  const anomalies = []
  if (report.duplicates.length) {
    anomalies.push(`дублей VerseId: ${report.duplicates.length} (${report.duplicates
      .slice(0, 3)
      .map((d) => `${d.bookId}:${d.chapter}:${d.verse}`)
      .join(', ')})`)
  }
  if (report.emptyVerses.length) {
    anomalies.push(`пустых стихов: ${report.emptyVerses.length}`)
  }
  console.log(
    `${code}: ${db.Books.length} книг${anomalies.length ? ` · вычищено: ${anomalies.join('; ')}` : ''}`,
  )
  if (problems.length) {
    hasProblems = true
    for (const p of problems) console.error(`  ПРОБЛЕМА: ${p}`)
  }
}

const songs = parseGlobalJs(readFileSync(join(dataDir, 'songs_ru.js'), 'utf8'))
writeFileSync(join(outDir, 'songs.json'), JSON.stringify(songs))
console.log(`Песни: ${songs.length}`)

// Демо-срез: Иоанна + Псалтирь в каждом переводе, первые 300 песен
const DEMO_BOOKS = ['JHN', 'PSA']
const demo = { translations: {}, songs: songs.slice(0, 300) }
for (const code of Object.keys(translations)) {
  const ids = DEMO_BOOKS.map((b) => TRANSLATION_MAPS[code]?.[b]).filter(Boolean)
  demo.translations[code] = {
    Translation: code,
    Books: full[code].Books.filter((b) => ids.includes(b.BookId)),
  }
}
writeFileSync(join(here, '..', 'src', 'lib', 'demo-data.json'), JSON.stringify(demo))
console.log('Демо-срез записан')

if (hasProblems) {
  console.error('Валидация нашла проблемы — см. выше')
  process.exit(1)
}
