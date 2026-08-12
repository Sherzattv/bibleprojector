/**
 * Связь с окном проектора в рантайме: BroadcastChannel-адаптер,
 * синглтон ProjectorLink, открытие окна на выбранном мониторе
 * (Window Management API) и управление им — fullscreen и закрытие.
 */
import { ProjectorLink, type Channel } from './projector-link.svelte'
import { ScreensStore, matchScreen, type ScreenInfo } from './screens.svelte'
import { ui } from './ui.svelte'

export const PROJECTION_CHANNEL = 'bp3-projection'

/** Именованное окно: повторный window.open попадает в него же, а не в новое */
const WINDOW_NAME = 'bp3-display'

/** Токен делегирования: экран разворачивается только по нашему сообщению */
export const FULLSCREEN_GRANT = 'bp3:fullscreen-grant'

/** `delegate` ещё не описан в lib.dom — объявляем сами */
interface DelegatingPostMessageOptions extends WindowPostMessageOptions {
  delegate?: string
}

/** Сколько ждём «hello» от экрана, прежде чем разворачивать вслепую */
const READY_TIMEOUT_MS = 4000

export const screens = new ScreensStore()

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
let displayWindow: Window | null = null

export function getProjectorLink(): ProjectorLink {
  if (!link) {
    link = new ProjectorLink(bcChannel())
    link.onReady = () => notifyDisplayReady()
    // Экран не смог развернуться сам — тихого отказа быть не должно
    link.onFullscreenFailed = () =>
      ui.notify('Не удалось развернуть автоматически — кликните по окну проектора.')
    link.start()
  }
  return link
}

const readyWaiters = new Set<() => void>()

/** Экран доложил о готовности — можно двигать окно и разворачивать его */
export function notifyDisplayReady(): void {
  const waiters = [...readyWaiters]
  readyWaiters.clear()
  for (const fn of waiters) fn()
}

function onDisplayReady(fn: () => void): void {
  let done = false
  const once = () => {
    if (done) return
    done = true
    fn()
  }
  readyWaiters.add(once)
  // Страховка: BroadcastChannel мог не доехать (расширение, приватный режим)
  setTimeout(once, READY_TIMEOUT_MS)
}

/** Параметры window.open: на известном мониторе — сразу его прямоугольник */
export function displayFeatures(target: ScreenInfo | null): string {
  if (!target) return 'popup,width=1024,height=768'
  return `popup,left=${target.left},top=${target.top},width=${target.width},height=${target.height}`
}

function fullscreenTarget(win: Window): Element | null {
  const doc = win.document as (Document & { fullscreenElement?: Element | null }) | undefined
  return doc?.fullscreenElement ?? null
}

/**
 * Передать окну проектора право развернуться (Fullscreen Capability Delegation,
 * Chrome 104+). `requestFullscreen()` требует свежего жеста в том самом
 * документе, который разворачивается, а клик оператора живёт в пульте — поэтому
 * и прямой вызов на чужом документе, и просьба по BroadcastChannel одинаково
 * получают отказ. `postMessage` с `delegate` переносит активацию туда, где она
 * нужна: экран вызывает fullscreen уже своей властью.
 */
function delegateFullscreen(win: Window): void {
  const options: DelegatingPostMessageOptions = {
    targetOrigin: window.location.origin,
    delegate: 'fullscreen',
  }
  try {
    win.postMessage(FULLSCREEN_GRANT, options)
  } catch {
    // Отказ в делегировании не должен рушить клик: ниже остаётся прямой вызов
  }
}

/**
 * Развернуть окно проектора. Делегирование — основной путь; прямой вызов
 * оставлен для браузеров без него, где fullscreen иногда проходит по той же
 * активации, что открыла окно (Fullscreen Companion Window). Если не вышло
 * и там, экран сам доложит о неудаче, и пульт подскажет оператору.
 */
async function enterFullscreen(win: Window, target: ScreenInfo | null): Promise<void> {
  if (win.closed) return
  if (fullscreenTarget(win)) return
  delegateFullscreen(win)
  const el = win.document?.documentElement as
    | (HTMLElement & { requestFullscreen(options?: unknown): Promise<void> })
    | undefined
  if (typeof el?.requestFullscreen !== 'function') return
  // Экран мог уже развернуться по делегированию — второй вызов не нужен
  if (fullscreenTarget(win)) return
  const raw = screens.rawFor(target)
  try {
    await el.requestFullscreen(raw ? { screen: raw } : undefined)
  } catch {
    // Дальше слово за экраном: он либо развернулся по делегированию,
    // либо пришлёт fullscreen-failed, и оператор увидит подсказку
  }
}

/**
 * Довести окно до нужного монитора. Возвращает экран, на котором оно стоит,
 * или null — когда монитор один и разворачивать нечего (иначе окно проектора
 * накрыло бы сам пульт).
 */
async function placeDisplay(win: Window, wanted: ScreenInfo | null): Promise<ScreenInfo | null> {
  const list = await screens.refresh({ prompt: true })
  if (win.closed) return null

  const target = list.length ? (matchScreen(wanted, list) ?? screens.target) : wanted
  if (!target) return null

  // Окно, которое уже развёрнуто, двигать нельзя — fullscreen просто слетит
  if (!fullscreenTarget(win)) {
    win.moveTo(target.left, target.top)
    win.resizeTo(target.width, target.height)
  }
  // Автоподбор тоже запоминаем: в следующий раз окно откроется здесь сразу
  if (!screens.saved) screens.select(target)
  return target
}

/**
 * Открыть окно проектора. Без аргумента — на запомненном или автоматически
 * выбранном мониторе; с аргументом — на указанном, и этот выбор запоминается.
 */
export function openDisplayWindow(target?: ScreenInfo): void {
  const url = new URL(window.location.href)
  url.hash = '#display'

  if (target) screens.select(target)
  const wanted = target ?? screens.target

  // Окно открываем синхронно, пока жива transient activation от клика (~5 с):
  // getScreenDetails() при первом обращении показывает запрос разрешения и висит
  // до ответа оператора — активация истекает, и window.open ловит попап-блокер.
  // Геометрию берём из localStorage, поэтому на знакомом мониторе окно
  // появляется сразу там, где нужно, и до разрешения дело даже не доходит.
  const win = window.open(url.toString(), WINDOW_NAME, displayFeatures(wanted))
  if (!win) {
    ui.notify('Браузер заблокировал окно проектора — разрешите всплывающие окна для этого сайта.')
    return
  }
  displayWindow = win

  const placed = placeDisplay(win, wanted)
  // Ждать готовности начинаем до первого await: иначе «hello» от быстро
  // загрузившегося экрана уйдёт в пустоту, пока мы ждём разрешение
  onDisplayReady(() => {
    void placed.then((screen) => (screen ? enterFullscreen(win, screen) : undefined))
  })
}

/** Развернуть окно проектора по клику оператора — активация свежая, сработает */
export function requestDisplayFullscreen(): void {
  const win = displayWindow
  if (!win || win.closed) {
    // Пульт перезагружали — ссылки на окно нет, а значит и делегировать некуда:
    // остаётся попросить экран развернуться самому и подсказать оператору
    link?.command('fullscreen')
    ui.notify('Кликните по окну проектора, чтобы развернуть его.')
    return
  }
  void enterFullscreen(win, screens.target)
}

/** Закрыть окно проектора */
export function closeDisplayWindow(): void {
  const win = displayWindow
  displayWindow = null
  if (win && !win.closed) win.close()
  // И на случай, если ссылка устарела (пульт перезагружали): экран закроется сам
  link?.command('close')
  // Окна уже нет — гасим признак сразу, не дожидаясь таймаута heartbeat,
  // иначе кнопки управления ещё несколько секунд висят вхолостую
  link?.markDisconnected()
}
