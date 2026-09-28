/**
 * Повторяющиеся наборы классов пульта. Правила — в lib/DESIGN.md; здесь
 * одно место, где меняется вид всех однотипных элементов сразу.
 */

/** Выпадающая панель: единственное место пульта, где разрешена тень */
export const popoverSurface = 'rounded-md border border-stroke-2 bg-panel-2 shadow-xl shadow-black/50'

/** Подпись группы внутри панели: «ПАЛИТРА», «ОТСЧЁТ» */
export const sectionLabel = 'text-2xs font-semibold tracking-wide text-faint uppercase'

/** Нативный select в панелях */
export const selectField = 'h-7 rounded border border-stroke-2 bg-panel px-1.5 text-sm text-ink'

/** Однострочное поле ввода в панелях */
export const textField =
  'h-7 w-full rounded border border-stroke-2 bg-panel px-2 text-sm text-ink placeholder:text-faint'

/** Квадратная кнопка-иконка в шапке, открывающая панель */
export function headerIconButton(active: boolean): string {
  return `grid size-7 place-items-center rounded border border-stroke-2 bg-panel-2 text-muted hover:bg-hover hover:text-ink
          ${active ? 'border-accent text-ink' : ''}`
}
