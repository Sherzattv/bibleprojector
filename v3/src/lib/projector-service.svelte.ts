/**
 * Связь с окном проектора в рантайме: BroadcastChannel-адаптер,
 * синглтон ProjectorLink и открытие окна на внешнем мониторе
 * (Window Management API с фоллбеком на обычный popup).
 */
import { ProjectorLink, type Channel } from './projector-link.svelte'

export const PROJECTION_CHANNEL = 'bp3-projection'

export function bcChannel(name: string = PROJECTION_CHANNEL): Channel {
  const bc = new BroadcastChannel(name)
  const channel: Channel = {
    post: (msg) => bc.postMessage(msg),
    onmessage: null,
  }
  bc.onmessage = (e) => channel.onmessage?.(e.data)
  return channel
}

let link: ProjectorLink | null = null

export function getProjectorLink(): ProjectorLink {
  if (!link) {
    link = new ProjectorLink(bcChannel())
    link.start()
  }
  return link
}

interface ScreenDetailsLike {
  screens: Array<{ left: number; top: number; width: number; height: number }>
  currentScreen: unknown
}

/** Открыть окно проектора — на внешнем мониторе, если браузер умеет */
export async function openDisplayWindow(): Promise<void> {
  const url = new URL(window.location.href)
  url.hash = '#display'

  if ('getScreenDetails' in window) {
    try {
      const details = (await (
        window as unknown as { getScreenDetails(): Promise<ScreenDetailsLike> }
      ).getScreenDetails())
      const external =
        details.screens.find((s) => s !== details.currentScreen) ?? details.screens[0]
      window.open(
        url.toString(),
        'bp3-display',
        `left=${external.left},top=${external.top},width=${external.width},height=${external.height}`,
      )
      return
    } catch {
      // разрешение не дано — обычное окно
    }
  }
  window.open(url.toString(), 'bp3-display', 'width=1024,height=768')
}
