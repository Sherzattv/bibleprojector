<script lang="ts">
  import { layout, type PanelName } from '../layout.svelte'
  import {
    clampPanelWidth,
    keyboardDelta,
    widthFromDrag,
    PANEL_MAX,
    PANEL_MIN,
    type PanelEdge,
  } from '../panel-size'

  interface Props {
    panel: PanelName
    /** С какой стороны рабочей области стоит панель */
    edge: PanelEdge
    label: string
    /** Рабочая область — по ней считаем, сколько места осталось центру */
    workspace?: HTMLElement
    /** Занято соседней панелью и разделителями */
    taken: number
  }
  let { panel, edge, label, workspace, taken }: Props = $props()

  let dragging = $state(false)
  let startX = 0
  let startWidth = 0

  function apply(desired: number) {
    const total = workspace?.getBoundingClientRect().width ?? window.innerWidth
    layout.setWidth(panel, clampPanelWidth(desired, { total, taken }))
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    dragging = true
    startX = e.clientX
    startWidth = layout.widthOf(panel)
    // Захват указателя: курсор может уехать за пределы полоски и даже за окно,
    // но события продолжат приходить сюда — иначе панель «отклеивается»
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    // Без этого браузер начинает выделять текст в соседних панелях
    e.preventDefault()
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return
    apply(widthFromDrag(startWidth, e.clientX - startX, edge))
  }

  function stopDrag(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Home') {
      e.preventDefault()
      apply(PANEL_MIN)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      apply(PANEL_MAX)
      return
    }
    const delta = keyboardDelta(e.key, edge, e.shiftKey)
    if (delta === null) return
    e.preventDefault()
    apply(layout.widthOf(panel) + delta)
  }

  // Пока тянут, курсор «ресайза» должен держаться над всей страницей, а текст
  // не выделяться — иначе быстрый рывок мышью оставляет синий след выделения
  $effect(() => {
    const root = document.documentElement
    root.classList.toggle('is-resizing', dragging)
    return () => root.classList.remove('is-resizing')
  })
</script>

<!-- Разделитель с фокусом — это виджет «window splitter» из ARIA: separator
     с tabindex и aria-valuenow управляется стрелками. Линтер знает только
     про декоративный separator, поэтому две его претензии здесь ложные. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="panel-resizer"
  class:is-library={panel === 'library'}
  class:is-setlist={panel === 'setlist'}
  class:is-dragging={dragging}
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={layout.widthOf(panel)}
  aria-valuemin={PANEL_MIN}
  aria-valuemax={PANEL_MAX}
  tabindex="0"
  title="{label}: тяните мышью, стрелки — по 16px, двойной клик вернёт исходную"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={stopDrag}
  onpointercancel={stopDrag}
  ondblclick={() => layout.resetWidth(panel)}
  onkeydown={onKeydown}
></div>
