<script lang="ts">
  import { BackgroundRenderer } from '../backgrounds/renderer'
  import { isAnimated, type BackgroundSettings } from '../backgrounds/settings'

  interface Props {
    settings: BackgroundSettings
    /** Замер контраста белого текста с фоном; null — фон чёрный */
    onContrast?: (ratio: number | null) => void
  }
  let { settings, onContrast }: Props = $props()

  let glCanvas = $state<HTMLCanvasElement>()
  let flowCanvas = $state<HTMLCanvasElement>()
  let renderer = $state<BackgroundRenderer | null>(null)

  $effect(() => {
    if (!glCanvas || !flowCanvas) return
    const r = new BackgroundRenderer(glCanvas, flowCanvas)
    renderer = r
    return () => {
      r.destroy()
      renderer = null
    }
  })

  $effect(() => {
    if (renderer) renderer.onContrast = onContrast ?? null
  })

  $effect(() => {
    renderer?.update({ ...settings })
  })
</script>

<!-- Фон рисуется в доле разрешения и растягивается: для мягких градиентов
     это незаметно, а видеокарта нагружается в разы меньше -->
<div class="pointer-events-none absolute inset-0" aria-hidden="true">
  <canvas bind:this={glCanvas} class="absolute inset-0 size-full" hidden></canvas>
  <canvas bind:this={flowCanvas} class="absolute inset-0 size-full" hidden></canvas>
  {#if isAnimated(settings)}
    <div class="absolute inset-0 bg-black" style="opacity: {settings.dim}"></div>
  {/if}
</div>
