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
            // 'prompt', а не 'autoUpdate': autoUpdate принудительно включает
            // skipWaiting + clientsClaim, и новый SW подменяет precache под
            // работающей вкладкой. Пульт при этом остаётся на старом бандле,
            // а окно проектора, открытое следом, поднимается уже на новой
            // оболочке — два окна расходятся по версиям, хотя говорят через
            // общий BroadcastChannel. Момент применения выбирает main.ts.
            registerType: 'prompt',
            // Регистрируем SW сами (main.ts), чтобы управлять моментом
            // обновления — автоскрипт registerSW.js этого не умеет
            injectRegister: false,
            // PNG-иконки не попадают под globPatterns ниже, но нужны офлайн
            // (favicon.svg добирается глобом — второй раз не перечисляем)
            includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png'],
            workbox: {
              // Данные (data/*.json) в precache не входят — их версионирует
              // manifest.json и кэширует data-cache
              globPatterns: ['**/*.{js,css,html,svg}'],
              navigateFallback: 'index.html',
              navigateFallbackDenylist: [/\/data\//],
              // Новый SW ждёт в waiting, пока оператор не закроет все окна
              // приложения: посреди служения версия оболочки не меняется.
              // clientsClaim нужен только самой первой установке — иначе окно
              // проектора в первой же сессии останется без SW и офлайна.
              skipWaiting: false,
              clientsClaim: true,
            },
            manifest: {
              name: 'Bible Projector',
              short_name: 'BibleProjector',
              description: 'Пульт вывода стихов Библии и песен на проектор',
              // Без lang плагин подставляет 'en', а интерфейс полностью русский
              lang: 'ru',
              display: 'standalone',
              background_color: '#0b0c0e',
              theme_color: '#0b0c0e',
              icons: [
                // PNG обязательны: Android и Windows не берут SVG для ярлыка.
                // maskable — логотип вписан в safe zone (62% канвы), переживает
                // обрезку до круга; фон непрозрачный, иначе система подставит
                // свой. Растеризованы из favicon.svg.
                {
                  src: 'icon-192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                {
                  src: 'icon-512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any maskable',
                },
                { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
              ],
            },
          }),
        ]),
  ],
}))
