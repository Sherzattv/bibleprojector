/**
 * Presentation API: браузер сам показывает диалог выбора экрана и сам
 * открывает страницу-приёмник на выбранном мониторе сразу во весь экран.
 * Пульт остаётся на месте — разворачивает не страница, а браузер, поэтому
 * не нужны ни жест в чужом документе, ни делегирование активации.
 *
 * Приёмник живёт в изолированном профиле: BroadcastChannel и window.opener
 * туда не добивают, общение — только строками через PresentationConnection.
 *
 * Типы объявлены свои: Presentation API в lib.dom описан не целиком.
 */

import type { Channel } from './projector-link.svelte'

export interface PresentationConnectionLike {
  state: 'connecting' | 'connected' | 'closed' | 'terminated'
  send(data: string): void
  close(): void
  terminate(): void
  onconnect: (() => void) | null
  onmessage: ((e: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onterminate: (() => void) | null
}

interface PresentationRequestLike {
  start(): Promise<PresentationConnectionLike>
}

type PresentationRequestCtor = new (urls: string[]) => PresentationRequestLike

function requestCtor(): PresentationRequestCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { PresentationRequest?: PresentationRequestCtor }
  return typeof w.PresentationRequest === 'function' ? w.PresentationRequest : null
}

export function presentationSupported(): boolean {
  return requestCtor() !== null
}

/**
 * Показать диалог выбора экрана и открыть там приёмник.
 * Отклоняется, если оператор закрыл диалог (NotAllowedError) или экранов нет.
 */
export function startPresentation(url: string): Promise<PresentationConnectionLike> {
  const Ctor = requestCtor()
  if (!Ctor) return Promise.reject(new Error('Presentation API недоступен'))
  try {
    return new Ctor([url]).start()
  } catch (e) {
    return Promise.reject(e)
  }
}

interface ConnectionListLike {
  connections: readonly PresentationConnectionLike[]
  addEventListener(
    type: 'connectionavailable',
    listener: (e: { connection: PresentationConnectionLike }) => void,
  ): void
}

export interface ReceiverChannel extends Channel {
  /** Контроллер подключился — самое время поздороваться заново */
  onOpen: (() => void) | null
}

/**
 * Канал экрана поверх Presentation API. null — окно открыто не браузером
 * (обычный попап), связь там по-прежнему через BroadcastChannel.
 * Контроллеров может быть несколько (пульт перезапускали) — шлём во все живые.
 */
export function presentationReceiverChannel(): ReceiverChannel | null {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as unknown as {
    presentation?: { receiver?: { connectionList: Promise<ConnectionListLike> } }
  }
  const receiver = nav.presentation?.receiver
  if (!receiver) return null

  const conns = new Set<PresentationConnectionLike>()
  const channel: ReceiverChannel = {
    onmessage: null,
    onOpen: null,
    post(msg: unknown) {
      const data = JSON.stringify(msg)
      for (const conn of conns) {
        if (conn.state !== 'connected') continue
        try {
          conn.send(data)
        } catch {
          // Соединение закрывается — onclose уберёт его из списка
        }
      }
    },
  }

  const adopt = (conn: PresentationConnectionLike) => {
    conns.add(conn)
    conn.onmessage = (e) => {
      if (typeof e.data !== 'string') return
      try {
        channel.onmessage?.(JSON.parse(e.data))
      } catch {
        // Битое сообщение протокол не роняет
      }
    }
    const drop = () => conns.delete(conn)
    conn.onclose = drop
    conn.onterminate = drop
    if (conn.state === 'connected') channel.onOpen?.()
    else conn.onconnect = () => channel.onOpen?.()
  }

  void receiver.connectionList.then((list) => {
    list.connections.forEach(adopt)
    list.addEventListener('connectionavailable', (e) => adopt(e.connection))
  })

  return channel
}
