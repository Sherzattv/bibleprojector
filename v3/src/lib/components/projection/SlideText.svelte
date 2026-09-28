<script lang="ts">
  import { autofitScale } from '../../projection/autofit'
  import {
    FONT_SIZE_FACTOR,
    LINE_OPACITY,
    lineStates,
    type FontFamily,
  } from '../../projection/content'
  import { lineIn, type SlideTransitionParams } from '../../projection/transitions'

  /**
   * Текст слайда (стих или куплет) с подписью. Общий для экрана проектора и
   * карточек «Превью»/«Эфир» — различается только масштаб, поэтому карточка
   * показывает ровно то, что увидит зал.
   */
  interface Props {
    text: string
    reference: string
    /** Подсвеченная строка песни; undefined — подсветки нет */
    line?: number
    fontFamily: FontFamily
    fontScale: number
    showReference: boolean
    size: 'screen' | 'card'
    motion?: SlideTransitionParams
  }
  let {
    text,
    reference,
    line,
    fontFamily,
    fontScale,
    showReference,
    size,
    motion = { kind: 'cut', ms: 0 },
  }: Props = $props()

  const SIZES = {
    screen: {
      box: 'max-w-[92%]',
      leading: 'leading-[1.5]',
      text: 'clamp(28px, 4.5vw, 72px)',
      ref: 'mt-8 tracking-[0.12em] text-amber uppercase',
      refSize: 'clamp(14px, 1.6vw, 24px)',
    },
    card: {
      box: 'relative max-w-[94%]',
      leading: 'leading-[1.55]',
      text: 'clamp(12px, 1.3vw, 18px)',
      ref: 'mt-2 text-amber',
      refSize: 'clamp(9px, 0.75vw, 11px)',
    },
  } as const

  const s = $derived(SIZES[size])
  const lines = $derived(lineStates(text, line))
  const scale = $derived(fontScale * FONT_SIZE_FACTOR[fontFamily] * autofitScale(text))
</script>

<div class={s.box}>
  <div
    class="{s.leading} text-balance text-white {fontFamily === 'sans' ? 'font-sans font-medium' : 'font-serif'}"
    style="font-size: calc({s.text} * {scale})"
  >
    {#each lines as l, i (i)}
      <span
        class="block transition-opacity duration-500"
        style={l.state ? `opacity: ${LINE_OPACITY[l.state]}` : ''}
        in:lineIn|global={{ ...motion, index: i }}>{l.text || ' '}</span
      >
    {/each}
  </div>
  {#if showReference}
    <div
      class={s.ref}
      style="font-size: calc({s.refSize} * {fontScale})"
      in:lineIn|global={{ ...motion, index: lines.length }}
    >
      {reference}
    </div>
  {/if}
</div>
