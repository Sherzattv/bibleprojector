<script lang="ts">
  import { findPalette, findPreset } from '../../backgrounds/catalog'

  /**
   * Образец фона плоскими полосами палитры (без градиентов — правило
   * DESIGN.md). Чёрный фон — сплошной чёрный, палитра у него не видна.
   */
  interface Props {
    preset: string
    palette: string
    /** Размер и рамка образца */
    class?: string
  }
  let { preset, palette, class: className = '' }: Props = $props()

  const colors = $derived(findPalette(palette).colors.slice(1))
  const black = $derived(findPreset(preset).kind === 'none')
</script>

<span class="flex shrink-0 overflow-hidden border border-stroke-2 {className}">
  {#if black}
    <span class="flex-1 bg-black"></span>
  {:else}
    {#each colors as c (c)}
      <span class="flex-1" style="background: {c}"></span>
    {/each}
  {/if}
</span>
