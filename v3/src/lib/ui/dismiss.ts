/**
 * Выпадающая панель закрывается кликом мимо неё и клавишей Esc.
 *
 * Вешается на обёртку, где лежат и кнопка, и сама панель: клик по кнопке
 * внутри — не «мимо», её собственный onclick переключит панель как раньше.
 * Esc с открытой панелью только закрывает её и не доходит до хоткеев пульта:
 * там Esc гасит эфир, а оператор хотел лишь убрать панель.
 */
export interface DismissParams {
  open: boolean
  close: () => void
}

export function dismissable(node: HTMLElement, params: DismissParams) {
  let current = params

  const onPointer = (e: PointerEvent) => {
    if (!current.open) return
    if (e.target instanceof Node && node.contains(e.target)) return
    current.close()
  }
  const onKey = (e: KeyboardEvent) => {
    if (!current.open || e.key !== 'Escape') return
    e.stopPropagation()
    current.close()
  }

  // Захват: клик по другой кнопке пульта сначала закроет панель, потом сработает сам
  document.addEventListener('pointerdown', onPointer, true)
  document.addEventListener('keydown', onKey, true)

  return {
    update(next: DismissParams) {
      current = next
    },
    destroy() {
      document.removeEventListener('pointerdown', onPointer, true)
      document.removeEventListener('keydown', onKey, true)
    },
  }
}
