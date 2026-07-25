import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Страж синхронизации: v3/src/lib/legacy/* — точные копии app/js/modules/*.
// Если тест красный — копии разошлись, синхронизируйте вручную.

const files = ['canonical.js', 'search.js', 'songs.js']

function read(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
}

describe('legacy-копии синхронизированы с app/js/modules', () => {
  for (const f of files) {
    it(`${f}: v3/src/lib/legacy совпадает с app/js/modules побайтово`, () => {
      const original = read(`../../app/js/modules/${f}`)
      const copy = read(`../src/lib/legacy/${f}`)
      expect(copy, `копии разошлись — синхронизируйте app/js/modules/${f} и v3/src/lib/legacy/${f}`).toBe(
        original,
      )
    })
  }
})
