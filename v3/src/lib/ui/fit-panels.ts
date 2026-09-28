/**
 * Действие для рабочей области: ширины запомнились на внешнем мониторе, а
 * пульт открыли на ноутбуке — и панели съели центр. Подрезаем сохранённое
 * по реальной ширине окна при старте и при каждом изменении размера.
 */
import type { Action } from 'svelte/action'
import { layout, type PanelName } from './layout.svelte'
import { fitPanels, PANEL_RAIL } from './panel-size'

export const fitPanelsToWindow: Action<HTMLElement, boolean> = (node, enabled = true) => {
  let active = enabled

  const fit = () => {
    if (!active) return
    const total = node.getBoundingClientRect().width
    if (!total) return
    // Ужимаем только развёрнутые панели; свёрнутые занимают колонку иконок
    const open = (['library', 'setlist'] as const satisfies readonly PanelName[]).filter((p) =>
      p === 'library' ? layout.libraryOpen : layout.setlistOpen,
    )
    const reserved = (2 - open.length) * PANEL_RAIL
    const fitted = fitPanels(
      open.map((p) => layout.widthOf(p)),
      { total, reserved },
    )
    open.forEach((p, i) => {
      if (fitted[i] !== layout.widthOf(p)) layout.setWidth(p, fitted[i])
    })
  }

  fit()
  window.addEventListener('resize', fit)
  return {
    update(next = true) {
      active = next
      fit()
    },
    destroy() {
      window.removeEventListener('resize', fit)
    },
  }
}
