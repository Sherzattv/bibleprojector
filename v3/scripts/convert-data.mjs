/**
 * Конвертирует исходные базы (v3/data/source/*.js, глобальные window.*)
 * в чистый JSON для v3:
 *   public/data/{rst,nrt,ktb,kyb}.json — переводы (gitignored)
 *   public/data/songs{,_kk,_ky}.json — песни по языкам (gitignored)
 *   src/lib/demo-data.json — срез для демо-сборки одним файлом (gitignored)
 * Данные проходят чистку (дубли VerseId, пустые стихи) и валидацию.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  parseGlobalJs,
  sanitizeBible,
  validateBible,
  buildManifest,
  DEMO_BOOK_IDS,
} from './convert-core.mjs'
import { SONG_LANGS, namespaceSongs, validateSongs } from './songs-core.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'data', 'source')
const outDir = join(here, '..', 'public', 'data')
mkdirSync(outDir, { recursive: true })

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

// Песни: русские — как есть (id сохранённых порядков служения не меняются),
// остальные языки — со сдвигом id в своё пространство
const songsByLang = {}
for (const [lang, { file, json }] of Object.entries(SONG_LANGS)) {
  const songs = namespaceSongs(parseGlobalJs(readFileSync(join(dataDir, file), 'utf8')), lang)
  const problems = validateSongs(songs, lang)
  songsByLang[lang] = songs
  const content = JSON.stringify(songs)
  written[json] = content
  writeFileSync(join(outDir, json), content)
  console.log(`Песни ${lang}: ${songs.length}`)
  if (problems.length) {
    hasProblems = true
    for (const p of problems.slice(0, 10)) console.error(`  ПРОБЛЕМА: ${p}`)
  }
}

// Манифест версий: офлайн-клиент перекачивает только изменившиеся файлы
const manifest = buildManifest(written)
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest))
console.log(`Манифест: версия ${manifest.version}`)

// Демо-срез: Иоанна + Псалтирь в каждом переводе, первые 300 русских песен
// и по 50 казахских и киргизских
const demo = {
  translations: {},
  songs: Object.fromEntries(
    Object.entries(songsByLang).map(([lang, songs]) => [lang, songs.slice(0, lang === 'ru' ? 300 : 50)]),
  ),
}
const ids = Object.values(DEMO_BOOK_IDS)
for (const code of Object.keys(translations)) {
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
