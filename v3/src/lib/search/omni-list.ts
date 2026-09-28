/**
 * Клавиатурная модель выпадашки поиска: плоский список опций,
 * циклическая навигация, действие по активной опции.
 * Чистые функции — покрыты tests/omni-list.test.ts.
 */

export type OmniOption =
  | { kind: 'ref' }
  | { kind: 'verse'; index: number }
  | { kind: 'song'; index: number }

export function buildOptions(
  hasRef: boolean,
  verseCount: number,
  songCount: number,
): OmniOption[] {
  const options: OmniOption[] = []
  if (hasRef) options.push({ kind: 'ref' })
  for (let i = 0; i < verseCount; i++) options.push({ kind: 'verse', index: i })
  for (let i = 0; i < songCount; i++) options.push({ kind: 'song', index: i })
  return options
}

export function nextIndex(count: number, current: number, delta: 1 | -1): number {
  if (count <= 0) return -1
  if (current < 0) return delta === 1 ? 0 : count - 1
  return (current + delta + count) % count
}

/**
 * Отложенное закрытие выпадашки по blur: список исчезает не сразу, чтобы
 * клик по опции успел отработать.
 *
 * Возврат фокуса ОБЯЗАН снимать отложенное закрытие. Иначе «хвост» от
 * прошлого blur (оператор кликнул мимо, тут же вернулся в поиск и набрал
 * новый запрос) схлопывает выпадашку уже под свежие результаты — на экране
 * поле с текстом и ни одной опции.
 */
export interface DeferredClose {
  /** Фокус ушёл — закрыть через delayMs */
  onBlur(): void
  /** Фокус вернулся — отменить отложенное закрытие */
  onFocus(): void
  cancel(): void
}

export function createDeferredClose(close: () => void, delayMs = 150): DeferredClose {
  let timer: ReturnType<typeof setTimeout> | null = null

  function cancel() {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  return {
    onBlur() {
      cancel()
      timer = setTimeout(() => {
        timer = null
        close()
      }, delayMs)
    },
    onFocus: cancel,
    cancel,
  }
}

/**
 * Действие для активной опции; вне границ/-1 — первая по приоритету.
 * В эфир с модификатором может уйти ТОЛЬКО точная ссылка.
 */
export function pickActionAt(
  options: OmniOption[],
  activeIdx: number,
  withModifier: boolean,
):
  | { type: 'ref'; live: boolean }
  | { type: 'verse'; index: number }
  | { type: 'song'; index: number }
  | null {
  if (!options.length) return null
  const option = options[activeIdx >= 0 && activeIdx < options.length ? activeIdx : 0]
  if (option.kind === 'ref') return { type: 'ref', live: withModifier }
  if (option.kind === 'verse') return { type: 'verse', index: option.index }
  return { type: 'song', index: option.index }
}
