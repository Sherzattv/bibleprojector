/**
 * Переходы между слайдами на экране проектора — svelte-transitions.
 * Чистые функции от параметров — покрыты tests/transitions.test.ts.
 *
 * Уходящий слайд всегда короче входящего: смена читается как «одно
 * растворилось, другое проявилось», а не как два текста поверх друг друга.
 */
import { cubicOut } from 'svelte/easing'
import type { TransitionConfig } from 'svelte/transition'
import type { TransitionKind } from './projection'

export interface SlideTransitionParams {
  kind: TransitionKind
  ms: number
}

/** Уходящий слайд гаснет за эту долю длительности */
const OUT_SHARE = 0.6
/** Входящий ждёт, пока уходящий частично погаснет (кроме плавной смены) */
const IN_DELAY_SHARE = 0.2

const none: TransitionConfig = { duration: 0 }

export function slideIn(_node: Element, { kind, ms }: SlideTransitionParams): TransitionConfig {
  switch (kind) {
    case 'fade':
      return { duration: ms, easing: cubicOut, css: (t) => `opacity: ${t}` }
    case 'blur':
      return {
        duration: ms,
        delay: ms * IN_DELAY_SHARE,
        easing: cubicOut,
        css: (t, u) =>
          `opacity: ${t}; filter: blur(${u * 12}px); transform: scale(${1 + u * 0.03})`,
      }
    case 'rise':
      return {
        duration: ms,
        delay: ms * IN_DELAY_SHARE,
        easing: cubicOut,
        css: (t, u) => `opacity: ${t}; transform: translateY(${u * 1.6}vw)`,
      }
    // «По строкам» анимирует сами строки (lineIn), контейнер появляется сразу
    case 'lines':
    case 'cut':
      return none
  }
}

export function slideOut(_node: Element, { kind, ms }: SlideTransitionParams): TransitionConfig {
  const duration = ms * OUT_SHARE
  switch (kind) {
    case 'fade':
    case 'lines':
      return { duration, css: (t) => `opacity: ${t}` }
    case 'blur':
      return { duration, css: (t, u) => `opacity: ${t}; filter: blur(${u * 6}px)` }
    case 'rise':
      return { duration, css: (t, u) => `opacity: ${t}; transform: translateY(${-u * 0.8}vw)` }
    case 'cut':
      return none
  }
}

/** Строка слайда в переходе «По строкам»: выходят по очереди, снизу вверх */
export function lineIn(
  _node: Element,
  { kind, ms, index }: SlideTransitionParams & { index: number },
): TransitionConfig {
  if (kind !== 'lines') return none
  return {
    duration: ms,
    delay: ms * IN_DELAY_SHARE + index * Math.min(140, ms / 5),
    easing: cubicOut,
    css: (t, u) => `opacity: ${t}; transform: translateY(${u * 0.8}vw)`,
  }
}
