/**
 * Связь с окном проектора в рантайме: BroadcastChannel-адаптер,
 * синглтон ProjectorLink, открытие окна на выбранном мониторе
 * (Window Management API) и управление им — fullscreen и закрытие.
 */
import { ProjectorLink, type Channel } from './projector-link.svelte'
import {
  presentationSupported,
  startPresentation,
  type PresentationConnectionLike,
} from './presentation'
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
/** Канал линка — чтобы подключать транспорты, появившиеся позже */
let activeChannel: Channel | null = null
/** Живое соединение Presentation API, если экран вывел сам браузер */
let presentationConn: PresentationConnectionLike | null = null
let displayWindow: Window | null = null

export function getProjectorLink(): ProjectorLink {
  if (!link) {
    const bc = bcChannel()
    // Пульт говорит сразу во все транспорты: BroadcastChannel добивает до
    // попапа, PresentationConnection — до экрана, который вывел браузер
    // (тот живёт в изолированном профиле, и BroadcastChannel туда не доходит)
    const channel: Channel = {
      post: (msg) => {
        bc.post(msg)
        if (presentationConn?.state === 'connected') {
          try {
            presentationConn.send(JSON.stringify(msg))
          } catch {
            // Соединение закрывается — heartbeat заметит сам
          }
        }
      },
      onmessage: null,
    }
    bc.onmessage = (msg) => channel.onmessage?.(msg)
    activeChannel = channel
    link = new ProjectorLink(channel)
    link.onReady = () => notifyDisplayReady()
    // Экран не смог развернуться сам — тихого отказа быть не должно.
    // Причину показываем рядом: без неё непонятно, чинить код или настройки.
    link.onFullscreenFailed = (reason) =>
      ui.notify(
        reason
          ? `Не удалось развернуть: ${reason}. Кликните по окну проектора.`
          : 'Не удалось развернуть автоматически — кликните по окну проектора.',
      )
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
 * Развернуть окно проектора.
 *
 * Прямой вызов `requestFullscreen()` на документе чужого окна здесь не делаем
 * намеренно. Он всё равно не проходит — активации в том документе нет, — но по
 * спецификации попытка без активации ещё и вычищает запись делегирования,
 * то есть способна отобрать право, которое мы только что передали.
 *
 * Окно перед этим фокусируем: свёрнутое или спрятанное за пультом окно
 * браузеры разворачивать отказываются, а фокус заодно поднимает его к оператору.
 * Монитор при этом не теряется — `placeDisplay` уже поставил окно на нужный
 * экран, и полноэкранный режим включается именно там.
 */
function enterFullscreen(win: Window): void {
  if (win.closed) return
  if (fullscreenTarget(win)) return
  try {
    win.focus()
  } catch {
    // Фокус — вспомогательный шаг: не вышло, пробуем развернуть как есть
  }
  delegateFullscreen(win)
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
 * Вывести проекцию.
 *
 * Основной путь — Presentation API: тот самый механизм, которым браузер сам
 * выводит страницу на выбранный экран. Chrome показывает свой диалог выбора
 * монитора и открывает приёмник там сразу во весь экран; пульт остаётся на
 * месте. Так это работает у AirVerse и «Лидера поклонения».
 *
 * Попап — фолбэк: явный выбор монитора из нашего меню, браузер без
 * Presentation API или офлайн — приёмник живёт в отдельном профиле браузера
 * без нашего Service Worker, и без сети ему неоткуда загрузить страницу.
 */
export async function openProjection(target?: ScreenInfo): Promise<void> {
  if (target || !presentationSupported() || navigator.onLine === false) {
    openDisplayWindow(target)
    return
  }

  const url = new URL(window.location.href)
  url.hash = '#display'
  try {
    adoptConnection(await startPresentation(url.toString()))
  } catch (e) {
    // Диалог закрыл сам оператор — не навязываем попап поверх его отказа
    if (e instanceof DOMException && e.name === 'NotAllowedError') return
    openDisplayWindow(target)
  }
}

/** Подключить соединение Presentation API к линку пульта */
function adoptConnection(conn: PresentationConnectionLike): void {
  getProjectorLink() // канал должен существовать до первых сообщений экрана
  presentationConn = conn
  conn.onmessage = (e) => {
    if (typeof e.data !== 'string') return
    try {
      activeChannel?.onmessage?.(JSON.parse(e.data))
    } catch {
      // Битое сообщение протокол не роняет
    }
  }
  const drop = () => {
    if (presentationConn !== conn) return
    presentationConn = null
    link?.markDisconnected()
  }
  conn.onclose = drop
  conn.onterminate = drop
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
    void placed.then((screen) => (screen ? enterFullscreen(win) : undefined))
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
  enterFullscreen(win)
}

/** Закрыть окно проектора */
export function closeDisplayWindow(): void {
  // Экран, который вывел браузер, закрывается через terminate — window.close
  // в изолированном приёмнике не работает
  const conn = presentationConn
  presentationConn = null
  if (conn) {
    try {
      conn.terminate()
    } catch {
      // Уже закрыто — и хорошо
    }
  }
  const win = displayWindow
  displayWindow = null
  if (win && !win.closed) win.close()
  // И на случай, если ссылка устарела (пульт перезагружали): экран закроется сам
  link?.command('close')
  // Окна уже нет — гасим признак сразу, не дожидаясь таймаута heartbeat,
  // иначе кнопки управления ещё несколько секунд висят вхолостую
  link?.markDisconnected()
}
