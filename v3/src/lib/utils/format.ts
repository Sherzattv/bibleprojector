/**
 * Форматирование подписей интерфейса.
 * Чистые функции — покрыты tests/utils/format.test.ts.
 */

/** Часы и минуты по местному времени: «09:05» */
export function formatClock(at: Date | number): string {
  const d = at instanceof Date ? at : new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Формы существительного для 1, 2–4 и 5+: ['показ', 'показа', 'показов'] */
export type PluralForms = readonly [one: string, few: string, many: string]

/** Форма по правилам русского языка: 1 показ, 3 показа, 11 показов, 21 показ */
export function pluralRu(count: number, [one, few, many]: PluralForms): string {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

/** Число вместе с согласованным словом: «3 элемента» */
export function countLabel(count: number, forms: PluralForms): string {
  return `${count} ${pluralRu(count, forms)}`
}
