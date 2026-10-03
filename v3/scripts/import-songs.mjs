/**
 * Импорт песен из OpenLP-базы Worship Leader в исходник v3/data/source.
 *
 *   node scripts/import-songs.mjs kk ~/Downloads/kk.sqlite
 *   node scripts/import-songs.mjs ky ~/Downloads/ky.sqlite
 *
 * Базы скачиваются по адресу из OPENLP_URL (kk, ky, ru …). Скрипт
 * выбрасывает пустышки (нет текста, только аккорды), сортирует песни по
 * названию и пишет data/source/songs_<язык>.js. Дальше — `npm run data`.
 * SQLite читается встроенным node:sqlite (Node 22.13+).
 */
import { writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPENLP_URL, SONG_LANGS, songsFromRows } from './songs-core.mjs'

const [lang, file] = process.argv.slice(2)
if (!lang || !file || !SONG_LANGS[lang]) {
  console.error(`Использование: node scripts/import-songs.mjs <${Object.keys(SONG_LANGS).join('|')}> <база.sqlite>`)
  process.exit(1)
}

let DatabaseSync
try {
  ;({ DatabaseSync } = await import('node:sqlite'))
} catch {
  console.error('Нужен Node 22.13+ со встроенным node:sqlite')
  process.exit(1)
}

const db = new DatabaseSync(file, { readOnly: true })
const rows = db
  .prepare('SELECT id, title, alternate_title, lyrics, song_number, copyright FROM songs')
  .all()
db.close()

const { songs, dropped } = songsFromRows(rows, lang)
const { file: outName, global } = SONG_LANGS[lang]
const url = OPENLP_URL.replace('{lang}', lang)
const out = [
  '/**',
  ` * Worship songs (${lang}) from Worship Leader App OpenLP export.`,
  ` * Source: ${url}`,
  ` * Imported by scripts/import-songs.mjs from ${basename(file)}.`,
  ' */',
  `window.${global} = ${JSON.stringify(songs)};`,
  '',
].join('\n')

const here = dirname(fileURLToPath(import.meta.url))
const target = join(here, '..', 'data', 'source', outName)
writeFileSync(target, out)
console.log(`${lang}: импортировано песен: ${songs.length} → data/source/${outName} (пустышек выброшено: ${dropped})`)
