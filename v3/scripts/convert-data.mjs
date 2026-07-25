/**
 * Конвертирует исходные базы (v3/data/source/*.js, глобальные window.*)
 * в чистый JSON для v3:
 *   public/data/{rst,nrt,ktb,kyb,songs}.json — полные данные (gitignored)
 *   src/lib/demo-data.json — срез для демо-сборки одним файлом (gitignored)
 * Данные проходят чистку (дубли VerseId, пустые стихи) и валидацию.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parseGlobalJs, sanitizeBible, validateBible, buildManifest } from './convert-core.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data', 'source')
const outDir = join(here, '..', 'public', 'data')
mkdirSync(outDir, { recursive: true })

const { TRANSLATION_MAPS } = await import(
  join(here, '..', 'src', 'lib', 'legacy', 'canonical.js')
)

const translations = {
  RST: 'bible_data.js',
  NRT: 'nrt_data.js',
  KTB: 'ktb_data.js',
  KYB: 'kyb_data.js',
}

let hasProblems = false
const full = {}
const written = {}
for (const [code, file] of Object.entries(translations)) {
  const raw = parseGlobalJs(readFileSync(join(dataDir, file), 'utf8'))
  const { db, report } = sanitizeBible(raw)
  const problems = validateBible(db)

  full[code] = db
  const json = JSON.stringify(db)
  written[`${code.toLowerCase()}.json`] = json
  writeFileSync(join(outDir, `${code.toLowerCase()}.json`), json)

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
const songsJson = JSON.stringify(songs)
written['songs.json'] = songsJson
writeFileSync(join(outDir, 'songs.json'), songsJson)
console.log(`Песни: ${songs.length}`)

// Манифест версий: офлайн-клиент перекачивает только изменившиеся файлы
const manifest = buildManifest(written)
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest))
console.log(`Манифест: версия ${manifest.version}`)

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
