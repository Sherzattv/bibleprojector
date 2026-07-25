import { describe, it, expect } from 'vitest'
// @ts-expect-error Node ESM helper written in JavaScript without declarations.
import { hashContent, buildManifest } from '../scripts/convert-core.mjs'

// ── hashContent ────────────────────────────────────────

describe('hashContent — короткий sha256-хэш содержимого', () => {
  it('детерминирован: одинаковая строка → одинаковый хэш', () => {
    expect(hashContent('window.bible_data = {};')).toBe(hashContent('window.bible_data = {};'))
  })

  it('разные строки → разные хэши', () => {
    expect(hashContent('стих первый')).not.toBe(hashContent('стих второй'))
  })

  it('возвращает ровно 16 hex-символов', () => {
    expect(hashContent('любое содержимое')).toMatch(/^[0-9a-f]{16}$/)
  })

  it('пустая строка тоже хэшируется в 16 hex-символов', () => {
    expect(hashContent('')).toMatch(/^[0-9a-f]{16}$/)
  })
})

// ── buildManifest ──────────────────────────────────────

describe('buildManifest — манифест версий для офлайн-кэша', () => {
  it('для каждого файла пишет hash = hashContent(содержимое)', () => {
    const manifest = buildManifest({ 'bible.json': '{"Books":[]}' })
    expect(manifest.files['bible.json'].hash).toBe(hashContent('{"Books":[]}'))
  })

  it('size — длина содержимого в байтах UTF-8 (кириллица: «аб» = 4 байта)', () => {
    const manifest = buildManifest({ 'ru.json': 'аб', 'en.json': 'ab' })
    expect(manifest.files['ru.json'].size).toBe(4)
    expect(manifest.files['en.json'].size).toBe(2)
  })

  it('version детерминирована: те же файлы → та же version', () => {
    const files = { 'a.json': 'альфа', 'b.json': 'бета' }
    expect(buildManifest(files).version).toBe(buildManifest(files).version)
  })

  it('изменение одного файла меняет version', () => {
    const before = buildManifest({ 'a.json': 'альфа', 'b.json': 'бета' })
    const after = buildManifest({ 'a.json': 'альфа (новая)', 'b.json': 'бета' })
    expect(after.version).not.toBe(before.version)
  })

  it('version не зависит от порядка ключей в объекте', () => {
    const forward = buildManifest({ a: 'раз', b: 'два' })
    const backward = buildManifest({ b: 'два', a: 'раз' })
    expect(forward.version).toBe(backward.version)
  })

  it('пустой набор файлов → валидный манифест со стабильной version', () => {
    const manifest = buildManifest({})
    expect(manifest.files).toEqual({})
    expect(typeof manifest.version).toBe('string')
    expect(manifest.version.length).toBeGreaterThan(0)
    expect(manifest.version).toBe(buildManifest({}).version)
  })

  it('version — агрегат, а не хэш одного из файлов', () => {
    const manifest = buildManifest({ 'a.json': 'раз', 'b.json': 'два' })
    const fileHashes = Object.values(manifest.files).map((f: { hash: string }) => f.hash)
    expect(fileHashes).not.toContain(manifest.version)
  })
})
