# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Bible Projector v3 preview** в отдельном каталоге `v3/`: Svelte 5,
  TypeScript, Vite, Tailwind CSS 4 и компонентная архитектура.
- Единый Omnibox с поиском Библии и песен через MiniSearch в Web Worker.
- Отдельный экран проектора с BroadcastChannel, Window Management API
  и Wake Lock.
- Версионированная офлайн-доставка данных и production PWA-сборка.
- Персистентные порядок служения и история эфира с миграцией данных v2.
- Выдвижные боковые панели v3 как fallback для узких окон.
- Playwright E2E критических путей для точной ссылки, многосекционной песни,
  порядка, восстановления состояния и отдельного окна проектора.

### Changed
- CI проверяет обе линии приложения, а для v3 запускает Svelte/TypeScript,
  модульные тесты, production-сборку и Chromium E2E.
- v3 `3.0.0-preview.1` стала основной и единственной активной линией
  разработки.
- v2.2.0 в `app/` заморожена как опубликованная legacy-версия и источник
  данных для конвертера; новые продуктовые функции в неё не добавляются.
- Корневая документация, roadmap и архивные проектные документы разделены
  на актуальные источники истины и исторические материалы.
- Поддерживаемая платформа пульта v3 зафиксирована как desktop Chromium с
  минимальным окном `1280×720`; планшеты и телефоны исключены из релизных
  требований.
- Текущий фокус roadmap перенесён на UX-полировку desktop-интерфейса;
  последующие E2E, офлайн-проверка, управление проектором и autofit сохранены
  в явной очередности.
- v3 перенесена с временного `/next/` на основной URL; Cloudflare теперь
  публикует только production-сборку `v3/dist/`.
- Runtime v2 удалён из CI и корневого toolchain; CI теперь проверяет
  production-сборку Cloudflare и тесты только активной v3.

### Fixed
- Исправлен Cloudflare-деплой, при котором запросы CSS и JavaScript под
  `/next/` попадали в SPA fallback и получали legacy HTML вместо статических
  файлов.

## [2.2.0] - 2026-07-25

### Added
- **Кыргызский перевод (KYB)** с локализованными названиями книг,
  сокращениями и офлайн-базой.
- **Офлайн-каталог песен** с поиском по названию, номеру и тексту.
- **Слайды песен**: куплеты, припевы и бриджи можно отправлять в эфир
  отдельно.
- **Порядок служения**: панель слева — заранее собранный список песен, стихов
  и заметок на служение. Сохраняется локально, переставляется, экспортируется
  и импортируется в JSON. Навигация ↑/↓ на краю песни или главы автоматически
  переходит к следующему пункту списка.
- **Библиотека**: панель справа с вкладками «Песни / Библия / История» —
  заменяет три отдельные модалки. Кнопка «＋» на карточке добавляет находку
  в порядок служения, не трогая предпросмотр.
- **Сетка слайдов песни**: все куплеты и припевы плитками под предпросмотром,
  клик — сразу в эфир.
- **Сворачиваемые панели**: F2 — порядок служения, F4 — библиотека.
  Состояние запоминается между запусками.
- **`npm run verify:layout`**: авто-проверка, что ни при какой ширине окна и
  ни при каком состоянии панелей интерфейс не выходит за пределы экрана
  (9 размеров × все состояния панелей).
- **Сайт проекта**: лендинг, инструкции по установке, контакты и форма
  обратной связи.
- **Cloudflare Workers Static Assets**: конфигурация для публикации
  статического сайта и приложения.

### Fixed
- **Панели больше не выезжают за экран.** Раскладка переписана на строгий
  контракт: центральная колонка объявлена `minmax(0, 1fr)` и поглощает всю
  свободную ширину, поэтому разворачивание любой боковой панели не может
  вытолкнуть соседнюю за край экрана. Дополнительно: `min-width: 0` на всех
  контейнерах со скроллом, перенос длинных слов (`overflow-wrap: anywhere`),
  `100dvh` вместо `100vh`, убран маскирующий `overflow-x: hidden` у `body`.
- На узких экранах боковые панели становятся выдвижными поверх контента,
  а не сжимают рабочую область.

### Changed
- Каждая панель адаптируется под собственную ширину через `@container`,
  а не под ширину окна — вид панели корректен при любом состоянии соседей.
- Быстрая заметка переехала из карточки в модальное окно (кнопка «📢 Заметка»).
- Service Worker v16: в прекэш добавлены новые модули и данные, а версия
  PWA синхронизирована с релизом.
- Проект переименован в **Bible Projector**, а публичные URL и SEO-метаданные
  переведены на `bibleprojector.kz`.

## [2.1.0] - 2026-01-12

### Added
- Навигация по стихам с помощью кнопок и клавиш со стрелками.
- Поддержка локального запуска на macOS.

### Fixed
- Исправлены смещения и отображение книг Псалтири.
- Исправлена инициализация приложения и мобильного меню.
- Улучшено безопасное отображение форматированного текста стихов.

## [2.0.0] - 2026-01-11

### Added
- **Full-text Search**: Search across all verses by text content with modal UI.
- **Export/Import Edits**: Backup and restore your verse edits as JSON files.
- **Offline Fallback Page**: User-friendly offline.html when resources unavailable.
- **Unit Tests**: 34 tests with Vitest covering search and history modules.
- **ESLint + Prettier**: Code quality tooling configured.

### Changed
- **Modular Architecture**: Refactored to ES6 modules:
  - `search.js` - parsing and verse lookup
  - `broadcast.js` - cross-window communication
  - `history.js` - XSS-safe history management
  - `settings.js` - settings and edits persistence
  - `dom-utils.js` - safe DOM manipulation
  - `loader.js` - lazy loading support
- **External CSS/JS**: Moved inline styles/scripts to separate files.
- **Service Worker v3**: Updated caching for modular architecture.
- **Loading UI**: Added progress bar with status text.
- **PWA Icons**: New professionally designed icons (192px, 512px).

### Security
- **XSS Fix**: Replaced innerHTML with textContent in history rendering.
- **Safe DOM Utils**: All user content rendered via textContent.

### Developer Experience
- **Testing**: `npm test` runs Vitest with jsdom.
- **Linting**: `npm run lint` for ESLint checks.
- **Version**: Updated to 2.0.0.

## [1.2.0] - 2025-12-25

### Added
- **PWA Support**: Progressive Web App with offline capability.
  - Added `manifest.json` for installability.
  - Added `sw.js` Service Worker for offline caching.
  - App can be installed on desktop/mobile and works without internet.

## [1.1.0] - 2025-12-25

### Added
- **Kazakh Translation (KTB):** Integrated `KTB_DATA` with 66 canonical books.
  - **Localized Book Names:** Book titles now display in Kazakh when KTB is selected.
  - **Localized Search:** Support for searching books using Kazakh names and abbreviations (e.g., "Жар", "Матай").
- **UI/UX:** Modern 2024-2025 aesthetics with Aurora gradients, Glassmorphism, and Bento grid layout.
  - Removed redundant "Translation" info card.
  - Redesigned bottom layout into a compact 3-column bento grid.
  - Moved broadcast controls to a dedicated "Эфир" (Live) panel.
- **Notes Feature**: Ability to broadcast custom text notes to the display screen.
- **Git Integration**: Initialized Git repository and restructured project layout.

### Changed
- **Project Structure**: Moved source files to `app/`, scripts to `scripts/`, and raw data to `sources/`.
- **Verse Search**: Optimized search logic and auto-update when switching translations.
- **Display Window**: Improved animations and responsiveness.

### Fixed
- **Lint Errors**: Fixed CSS appearance warnings in controller.html.
- **Translation Switching**: Fixed issue where switching from Kazakh to Russian references didn't work.
