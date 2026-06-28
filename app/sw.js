/**
 * Service Worker для PWA "Bible Projector"
 * Обеспечивает оффлайн-доступ к приложению.
 *
 * Стратегии:
 *   - Навигации (HTML)          → network-first  (свежий вход после деплоя; офлайн → кэш → offline.html)
 *   - Базы переводов (/js/data/)→ cache-first    (неизменяемые ~29 МБ — не тянем по сети зря)
 *   - Прочая статика (css/js)   → stale-while-revalidate (быстро из кэша + фоновое обновление)
 *
 * ВАЖНО: при изменении оболочки/данных поднимайте версию кэша ниже.
 */

const CACHE_VERSION = 'v11';
const CACHE_NAME = `bibleprojector-${CACHE_VERSION}`;
const OFFLINE_URL = './offline.html';

// Критичная оболочка приложения (нужна для офлайна; кэшируется атомарно при установке)
const CORE_ASSETS = [
    './',
    './controller.html',
    './display.html',
    './offline.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    // CSS
    './css/variables.css',
    './css/controller.css',
    './css/display.css',
    // Core JS
    './js/app.js',
    './js/display.js',
    // Modules
    './js/modules/canonical.js',
    './js/modules/search.js',
    './js/modules/broadcast.js',
    './js/modules/history.js',
    './js/modules/settings.js',
    './js/modules/dom-utils.js'
];

// Тяжёлые базы переводов (кэшируются по отдельности: сбой одной не срывает установку)
const DATA_ASSETS = [
    './js/data/bible_data.js',
    './js/data/nrt_data.js',
    './js/data/ktb_data.js',
    './js/data/kyb_data.js'
];

// Установка: оболочку — атомарно, данные — best-effort (по одной)
self.addEventListener('install', (event) => {
    event.waitUntil(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(CORE_ASSETS);
            // Данные кэшируем поштучно, чтобы один сбой не сорвал всю установку
            await Promise.allSettled(DATA_ASSETS.map((url) => cache.add(url)));
            await self.skipWaiting();
        })()
    );
});

// Активация: удалить старые версии кэша
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// Маршрутизация запросов
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Кэшируем только GET
    if (request.method !== 'GET') return;

    // Навигации (HTML-страницы) — network-first, чтобы обновления подхватывались после деплоя
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstNavigation(request));
        return;
    }

    const url = new URL(request.url);

    // Внешние ресурсы (например, Google Fonts) — отдаём браузеру с его HTTP-кэшем
    if (url.origin !== self.location.origin) return;

    // Базы переводов — cache-first (неизменяемые и тяжёлые)
    if (url.pathname.includes('/js/data/')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    // Прочая статика — stale-while-revalidate
    event.respondWith(staleWhileRevalidate(request));
});

// Сколько ждём сеть для навигации, прежде чем отдать кэш (защита от зависания
// на медленном/нестабильном Wi-Fi во время служения).
const NAV_TIMEOUT_MS = 3500;

/**
 * Network-first для навигаций: сеть (с таймаутом) → кэш → offline.html
 */
async function networkFirstNavigation(request) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const response = await fetchWithTimeout(request, NAV_TIMEOUT_MS);
        if (response && response.status === 200) {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        const offline = await cache.match(OFFLINE_URL);
        return offline || new Response('Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    }
}

/**
 * fetch с таймаутом через AbortController
 */
function fetchWithTimeout(request, ms) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(request, { signal: controller.signal })
        .finally(() => clearTimeout(timer));
}

/**
 * Cache-first: кэш → сеть (с дозаписью в кэш)
 */
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const response = await fetch(request);
        if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        return new Response('Offline', { status: 503 });
    }
}

/**
 * Stale-while-revalidate: мгновенно из кэша + фоновое обновление
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const networkFetch = fetch(request)
        .then((response) => {
            if (response && response.status === 200) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => null);

    return cached || (await networkFetch) || new Response('Offline', { status: 503 });
}
