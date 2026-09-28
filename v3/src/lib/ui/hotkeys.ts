/**
 * Глобальные хоткеи пульта. Чистые функции — покрыты tests/hotkeys.test.ts.
 *
 * Принцип: эфиром управляем только когда фокус «в никуда» (body/панели).
 * Любой интерактивный элемент (поле, селект, кнопка) забирает клавиши себе —
 * иначе Space на селекте перевода отправлял бы слайд в эфир.
 */

export type HotkeyAction = 'go' | 'next' | 'prev' | 'blackout' | 'clear' | 'focus-search'

export interface HotkeyEvent {
  code?: string
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  target: Element | null
}

const INTERACTIVE_SELECTOR = 'input, textarea, select, button, [contenteditable="true"], [contenteditable=""]'

export function isInteractiveTarget(el: Element | null): boolean {
  if (!el || typeof el.closest !== 'function') return false
  return el.closest(INTERACTIVE_SELECTOR) !== null
}

export function resolveHotkey(e: HotkeyEvent): HotkeyAction | null {
  // Поиск доступен из любого места, включая поля ввода
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') return 'focus-search'

  if (isInteractiveTarget(e.target)) return null

  if (e.code === 'Space') return 'go'
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return 'next'
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return 'prev'
  const key = e.key.toLowerCase()
  if (key === 'b' || key === 'и') return 'blackout'
  if (e.key === 'Escape') return 'clear'
  return null
}
