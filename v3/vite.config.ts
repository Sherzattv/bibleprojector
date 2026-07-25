import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

// Два режима сборки:
//  - обычный (прод): чанки + Service Worker (precache оболочки; данные
//    кэширует data-cache поверх Cache Storage) → полноценный офлайн
//  - demo: один самодостаточный html-файл для шаринга (без SW)
export default defineConfig(({ mode }) => ({
  plugins: [
    svelte(),
    tailwindcss(),
    ...(mode === 'demo'
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg'],
            workbox: {
              // Данные (data/*.json) в precache не входят — их версионирует
              // manifest.json и кэширует data-cache
              globPatterns: ['**/*.{js,css,html,svg}'],
              navigateFallback: 'index.html',
              navigateFallbackDenylist: [/\/data\//],
            },
            manifest: {
              name: 'Bible Projector',
              short_name: 'BibleProjector',
              description: 'Пульт вывода стихов Библии и песен на проектор',
              display: 'standalone',
              background_color: '#0b0c0e',
              theme_color: '#0b0c0e',
              icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
            },
          }),
        ]),
  ],
}))
