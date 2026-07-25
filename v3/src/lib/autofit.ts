/**
 * Автоподбор масштаба шрифта проекции: длинный стих не обрезается,
 * а показывается мельче. Чистая функция — покрыта tests/autofit.test.ts.
 */

const COMFORT_CHARS = 160
const COMFORT_LINES = 6
const CHARS_PER_LINE = 30
const MIN_SCALE = 0.4

export function autofitScale(text: string): number {
  const chars = text.length
  const lines = text ? text.split('\n').length : 0
  if (chars <= COMFORT_CHARS && lines <= COMFORT_LINES) return 1
  // Давят и общий объём, и количество строк; sqrt — потому что текст
  // масштабируется по двум осям сразу
  const effective = Math.max(chars, lines * CHARS_PER_LINE)
  return Math.max(MIN_SCALE, Math.min(1, Math.sqrt(COMFORT_CHARS / effective)))
}
