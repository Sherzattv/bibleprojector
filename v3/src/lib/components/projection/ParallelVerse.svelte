<script lang="ts">
  import { autofitScale } from '../../projection/autofit'
  import {
    FONT_SIZE_FACTOR,
    type FontFamily,
    type ParallelLayout,
    type SecondaryText,
  } from '../../projection/content'
  import { lineIn, type SlideTransitionParams } from '../../projection/transitions'

  /**
   * Стих в двух переводах: один под другим или рядом. Общий для экрана
   * проектора и карточек пульта — различается только масштаб.
   */
  interface Props {
    primary: SecondaryText
    secondary: SecondaryText
    layout: ParallelLayout
    fontFamily: FontFamily
    fontScale: number
    showReference: boolean
    /** Экран проектора или карточка пульта */
    size: 'screen' | 'card'
    motion?: SlideTransitionParams
  }
  let {
    primary,
    secondary,
    layout,
    fontFamily,
    fontScale,
    showReference,
    size,
    motion = { kind: 'cut', ms: 0 },
  }: Props = $props()

  // Два текста на одном экране: автоподбор считает их вместе, иначе длинный
  // стих во втором переводе вылезет за край
  const fit = $derived(autofitScale(`${primary.text}\n${secondary.text}`))
  const textSize = $derived(
    size === 'screen' ? 'clamp(22px, 3.4vw, 60px)' : 'clamp(10px, 1vw, 14px)',
  )
  const refSize = $derived(size === 'screen' ? 'clamp(12px, 1.3vw, 22px)' : 'clamp(8px, 0.65vw, 10px)')
  const gap = $derived(size === 'screen' ? '2.4vw' : '0.6vw')
  const parts = $derived([primary, secondary])
</script>

<div
  class="grid max-w-[96%] {layout === 'side' ? 'grid-cols-2 items-center' : ''}"
  style="gap: {gap}"
>
  {#each parts as part, i (i)}
    <div
      class={i === 1
        ? layout === 'side'
          ? 'border-l border-white/20'
          : 'border-t border-amber/40'
        : ''}
      style={i === 1 ? (layout === 'side' ? `padding-left: ${gap}` : `padding-top: ${gap}`) : ''}
    >
      <div
        class="leading-[1.42] text-balance text-white {fontFamily === 'sans'
          ? 'font-sans font-medium'
          : 'font-serif'}"
        style="font-size: calc({textSize} * {fontScale * FONT_SIZE_FACTOR[fontFamily] * fit})"
      >
        {#each part.text.split('\n') as line, j (j)}
          <span class="block" in:lineIn|global={{ ...motion, index: i * 8 + j }}
            >{line || ' '}</span
          >
        {/each}
      </div>
      {#if showReference}
        <div
          class="mt-[0.6em] tracking-[0.12em] text-amber uppercase"
          style="font-size: calc({refSize} * {fontScale})"
        >
          {part.reference}
        </div>
      {/if}
    </div>
  {/each}
</div>
