/**
 * Поведение окна проектора в браузере: не засыпать, разворачиваться по
 * праву от пульта и перезагружаться на новую версию вместе с ним.
 */
import { FULLSCREEN_GRANT } from './service.svelte'

/** Экран проектора не должен засыпать во время служения. Возвращает отмену */
export function keepScreenAwake(): () => void {
  let lock: { release?: () => Promise<void> } | undefined
  navigator.wakeLock
    ?.request('screen')
    .then((l) => (lock = l))
    .catch(() => {})
  return () => {
    void lock?.release?.()
  }
}

export function enterFullscreen(): void {
  void document.documentElement.requestFullscreen().catch(() => {})
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen()
  else enterFullscreen()
}

/** Следить за fullscreen страницы; Presentation API развёрнут всегда. Возвращает отмену */
export function watchFullscreen(alwaysOn: boolean, onChange: (on: boolean) => void): () => void {
  const sync = () => onChange(alwaysOn || Boolean(document.fullscreenElement))
  sync()
  document.addEventListener('fullscreenchange', sync)
  return () => document.removeEventListener('fullscreenchange', sync)
}

/**
 * Пульт передал право развернуться вместе с сообщением (capability
 * delegation). Активацию нужно потратить не отходя от обработчика — любой
 * await до вызова её теряет, поэтому requestFullscreen идёт здесь же,
 * синхронно. Причину отказа отдаём как есть: без неё «не сработало» не
 * отличить от «браузер не даёт». Возвращает отмену.
 */
export function acceptFullscreenGrant(onFailed: (reason: string) => void): () => void {
  const onGrant = (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.data !== FULLSCREEN_GRANT) return
    if (document.fullscreenElement) return
    document.documentElement.requestFullscreen().catch((err: unknown) => {
      onFailed(err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? 'unknown'))
    })
  }
  window.addEventListener('message', onGrant)
  return () => window.removeEventListener('message', onGrant)
}

/** Сколько ждать смены Service Worker'а, прежде чем перезагрузиться всё равно */
const RELOAD_FALLBACK_MS = 5000

/**
 * Пульт ставит новую версию. Попап живёт под тем же Service Worker'ом —
 * ждём, пока новый возьмёт управление, иначе перезагрузка поднимет старую
 * оболочку. Экран Presentation API грузится из сети — ему ждать нечего.
 */
export function reloadForUpdate(): void {
  const sw = navigator.serviceWorker
  if (!sw?.controller) {
    location.reload()
    return
  }
  sw.addEventListener('controllerchange', () => location.reload(), { once: true })
  setTimeout(() => location.reload(), RELOAD_FALLBACK_MS)
}
