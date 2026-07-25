/**
 * Конвертирует существующие базы (app/js/data/*.js, глобальные window.*)
 * в чистый JSON для v3:
 *   public/data/{rst,nrt,ktb,kyb,songs}.json — полные данные (gitignored)
 *   src/lib/demo-data.json — срез для демо-сборки одним файлом (gitignored)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..', '..')
const dataDir = join(repo, 'app', 'js', 'data')
const outDir = join(here, '..', 'public', 'data')
mkdirSync(outDir, { recursive: true })

const { TRANSLATION_MAPS } = await import(
  join(repo, 'app', 'js', 'modules', 'canonical.js')
)

function parseGlobalJs(file) {
  const src = readFileSync(file, 'utf8')
  // Данные — первая строка вида `window.X = {...}`; дальше могут идти
  // вспомогательные константы (KTB/KYB несут карту названий книг).
  const line = src.split('\n').find((l) => l.includes('window.'))
  const eq = line.indexOf('=')
  let body = line.slice(eq + 1).trim()
  if (body.endsWith(';')) body = body.slice(0, -1)
  return JSON.parse(body)
}

const translations = {
  RST: 'bible_data.js',
  NRT: 'nrt_data.js',
  KTB: 'ktb_data.js',
  KYB: 'kyb_data.js',
}

const full = {}
for (const [code, file] of Object.entries(translations)) {
  full[code] = parseGlobalJs(join(dataDir, file))
  writeFileSync(join(outDir, `${code.toLowerCase()}.json`), JSON.stringify(full[code]))
  console.log(`${code}: ${full[code].Books.length} книг`)
}

const songs = parseGlobalJs(join(dataDir, 'songs_ru.js'))
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
