import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// Отдельный конфиг: svelte-плагин нужен, чтобы runes ($state)
// работали в .svelte.ts-модулях; tailwind и singlefile в тестах не нужны.
export default defineConfig({
  // Те же константы, что подставляет сборка: без них любой тест,
  // затянувший компонент с версией в шапке, падал бы на ReferenceError
  define: {
    __APP_VERSION__: JSON.stringify('0.0.0-test'),
    __BUILD_COMMIT__: JSON.stringify('test'),
  },
  plugins: [svelte()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    conditions: ['browser'],
  },
})
