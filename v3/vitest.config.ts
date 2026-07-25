import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Отдельный конфиг: svelte-плагин нужен, чтобы runes ($state)
// работали в .svelte.ts-модулях; tailwind и singlefile в тестах не нужны.
export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    conditions: ['browser'],
  },
})
