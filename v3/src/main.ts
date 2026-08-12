/// <reference types="vite-plugin-pwa/vanillajs" />
import { mount } from 'svelte'
import { registerSW } from 'virtual:pwa-register'
import './app.css'
import Root from './Root.svelte'
import { mode } from './lib/mode.svelte'

// #display — окно проектора: только приём и показ, без данных и пульта.
// Роль больше не приколочена к загрузке: окно, из которого вывели проекцию,
// становится экраном на лету (см. lib/mode.svelte.ts)
const isDisplay = mode.isDisplay

// Как часто длинноживущая вкладка пульта сама спрашивает про новую версию
const UPDATE_CHECK_MS = 60 * 60 * 1000

// До миграции по этому же адресу жил рукописный SW с кэшем bibleprojector-vNN
// (~29 МБ баз переводов). Его activate уже никогда не выполнится, а workbox
// подчищает только свои *-precache-* кэши — значит чужой кэш висел бы вечно и
// приближал вытеснение наших данных браузером. Актуальные имена (bp3-data-v1,
// workbox-*) под префикс не попадают.
async function dropLegacyCaches(): Promise<void> {
  if (!('caches' in window)) return
  const names = await caches.keys()
  await Promise.all(
    names.filter((name) => name.startsWith('bibleprojector-')).map((name) => caches.delete(name)),
  )
}

dropLegacyCaches().catch(() => {})

// Пульт и окно проектора обязаны работать на одной версии оболочки: они
// связаны BroadcastChannel'ом и общим форматом сообщений. Поэтому новый SW не
// перехватывает управление на лету — он ждёт в waiting и активируется сам,
// когда оператор закроет все окна после служения. Обновление приходит к
// следующему запуску, а посреди эфира ничего не перезагружается.
// Если понадобится кнопка «обновить сейчас»: слушайте bp3:update-ready и
// шлите bp3:apply-update — SW возьмёт управление, страница перезагрузится.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('bp3:update-ready'))
  },
  onRegisteredSW(_swUrl, registration) {
    // Вкладку пульта держат открытой сутками; без опроса новая версия не
    // скачается и опоздает ещё на одно служение
    if (isDisplay || !registration) return
    setInterval(() => {
      registration.update().catch(() => {})
    }, UPDATE_CHECK_MS)
  },
})

window.addEventListener('bp3:apply-update', () => {
  updateSW().catch(() => {})
})

const app = mount(Root, {
  target: document.getElementById('app')!,
})

export default app
