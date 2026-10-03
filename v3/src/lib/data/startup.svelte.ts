/**
 * Запуск пульта: загрузка переводов и песен, индексация в Web Worker,
 * восстановление порядка служения и второго перевода. Вызывать при
 * инициализации корневого компонента пульта.
 */
import { untrack } from 'svelte'
import { projSettings } from '../projection/settings.svelte'
import { pushBible, pushSongs } from '../search/service.svelte'
import { setlist } from '../show/setlist.svelte'
import { show } from '../show/show.svelte'
import { ui } from '../ui/notices.svelte'
import { data } from './db.svelte'

/** Всё, что делается после успешной загрузки: общее для старта и повтора */
function afterDataReady(): void {
  if (data.status !== 'ready') return
  // Стартовое наполнение: первый элемент плейлиста, который удаётся открыть
  for (let i = 0; i < setlist.items.length && setlist.currentIdx < 0; i++) {
    setlist.open(i)
  }
  ui.clearNotice()
}

export function startData(): void {
  $effect(() => {
    data.init().then(afterDataReady)
  })

  // Второй перевод: берём из настроек при старте и пересобираем тексты главы,
  // когда он (или основной) догрузился в фоне
  $effect(() => {
    void data.bibles
    untrack(() => {
      show.secondaryCode = projSettings.secondaryTranslation
      show.refreshSecondary()
    })
  })

  // Отдаём воркеру перевод, как только он загружен/выбран
  $effect(() => {
    pushBible(data.translation, data.bibles[data.translation] ?? null)
  })

  // Песни — в Web Worker (индексация не блокирует главный поток): после
  // старта и заново, если база ещё одного языка догрузилась повтором
  $effect(() => {
    if (data.status === 'ready') pushSongs(data.songs)
  })
}

/**
 * Повтор после провала стартовой загрузки — не тупик: обновление страницы
 * часто не помогает, поэтому повтор есть прямо на экране ошибки
 */
export async function retryData(): Promise<void> {
  await data.retryInit()
  afterDataReady()
}
