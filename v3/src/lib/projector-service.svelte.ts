/**
 * Связь с окном проектора в рантайме: BroadcastChannel-адаптер,
 * синглтон ProjectorLink и открытие окна на внешнем мониторе
 * (Window Management API с фоллбеком на обычный popup).
 */
import { ProjectorLink, type Channel } from './projector-link.svelte'
import { ui } from './ui.svelte'

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

/**
 * Перенести уже открытое окно на внешний монитор.
 * Вызывается ПОСЛЕ window.open: запрос разрешения Window Management
 * может ждать ответа оператора сколько угодно — окно уже есть.
 */
async function moveToExternalScreen(win: Window): Promise<void> {
  if (!('getScreenDetails' in window)) return
  try {
    const details = await (
      window as unknown as { getScreenDetails(): Promise<ScreenDetailsLike> }
    ).getScreenDetails()
    const external =
      details.screens.find((s) => s !== details.currentScreen) ?? details.screens[0]
    if (!external || win.closed) return
    win.moveTo(external.left, external.top)
    win.resizeTo(external.width, external.height)
  } catch {
    // разрешение не дано — окно остаётся там, где открылось
  }
}

/** Открыть окно проектора — на внешнем мониторе, если браузер умеет */
export function openDisplayWindow(): void {
  const url = new URL(window.location.href)
  url.hash = '#display'

  // Окно открываем синхронно, пока жива transient activation от клика (~5 с):
  // getScreenDetails() при первом обращении показывает запрос разрешения и висит
  // до ответа оператора — активация истекает, и window.open ловит попап-блокер
  const win = window.open(url.toString(), 'bp3-display', 'width=1024,height=768')
  if (!win) {
    ui.notify('Браузер заблокировал окно проектора — разрешите всплывающие окна для этого сайта.')
    return
  }
  void moveToExternalScreen(win)
}
