<script lang="ts">
  import type { Snippet } from 'svelte'
  import { dismissable } from '../../ui/dismiss'
  import { popoverSurface } from './styles'

  /**
   * Кнопка и выпадающая панель под ней (или над ней — в доке). Панель
   * закрывается повторным нажатием, кликом мимо и клавишей Esc; Esc при
   * этом не доходит до хоткеев пульта и не гасит эфир.
   */
  interface Props {
    /** Имя панели для скринридера */
    label: string
    /** below — из шапки вниз к правому краю, above — из дока вверх от левого */
    placement?: 'below' | 'above'
    /** Размер, отступы и раскладка самой панели */
    panelClass?: string
    /** Классы обёртки: например, чтобы кнопка была составной */
    class?: string
    open?: boolean
    trigger: Snippet<[{ open: boolean; toggle: () => void }]>
    children: Snippet<[{ close: () => void }]>
  }
  let {
    label,
    placement = 'below',
    panelClass = '',
    class: wrapperClass = '',
    open = $bindable(false),
    trigger,
    children,
  }: Props = $props()

  const close = () => (open = false)
  const toggle = () => (open = !open)
  const position = $derived(placement === 'below' ? 'top-9 right-0' : 'bottom-9 left-0')
</script>

<div class="relative {wrapperClass}" use:dismissable={{ open, close }}>
  {@render trigger({ open, toggle })}
  {#if open}
    <div role="group" aria-label={label} class="absolute z-50 {position} {popoverSurface} {panelClass}">
      {@render children({ close })}
    </div>
  {/if}
</div>
