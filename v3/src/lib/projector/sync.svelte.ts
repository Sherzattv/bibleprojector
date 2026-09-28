/**
 * Пульт → экран проектора: всё, что уходит в эфир, и свои файлы оператора.
 * Вызывать при инициализации корневого компонента пульта.
 */
import { buildContent } from '../projection/content'
import { projSettings } from '../projection/settings.svelte'
import { serviceScreen } from '../projection/service-screen.svelte'
import { mediaLibrary } from '../media/library.svelte'
import { show } from '../show/show.svelte'
import { ui } from '../ui/notices.svelte'
import type { ProjectorLink } from './link.svelte'

export function syncProjector(projector: ProjectorLink): void {
  // Свои файлы оператора: подняли из IndexedDB — экран спросит их сам
  $effect(() => {
    void mediaLibrary.init()
  })
  projector.onMediaRequest = (slot) => {
    mediaLibrary
      .payload(slot)
      .then((p) => {
        if (p) projector.sendMedia(p)
      })
      .catch(() => ui.notify('Не удалось прочитать свой файл — загрузите его заново.'))
  }

  // Любое изменение эфира или настроек мгновенно уезжает на экран проектора
  $effect(() => {
    projector.sendState(
      buildContent({
        blackout: show.blackout,
        kind: show.kind,
        liveSlide: show.liveSlide,
        line: projSettings.lineHighlight ? show.liveLine : undefined,
        service: serviceScreen.content(),
      }),
      // $state.snapshot: вложенные ссылки — прокси, BroadcastChannel их не клонирует
      { ...projSettings.snapshot(), media: $state.snapshot(mediaLibrary.refs) },
    )
  })
}
