<script lang="ts">
  import { BackgroundRenderer } from '../backgrounds/renderer'
  import { findPreset } from '../backgrounds/catalog'
  import { contrastOnBackground } from '../backgrounds/contrast'
  import { isAnimated, type BackgroundSettings } from '../backgrounds/settings'

  interface Props {
    settings: BackgroundSettings
    /** Своё фото или видео оператора — object URL, когда файл уже пришёл */
    media?: { url: string; kind: 'image' | 'video' } | null
    /** Множитель яркости от пульса музыки; 1 — без пульса */
    gain?: number
    /** Замер контраста белого текста с фоном; null — фон чёрный */
    onContrast?: (ratio: number | null) => void
  }
  let { settings, media = null, gain = 1, onContrast }: Props = $props()

  let glCanvas = $state<HTMLCanvasElement>()
  let flowCanvas = $state<HTMLCanvasElement>()
  let mediaEl = $state<HTMLImageElement | HTMLVideoElement>()
  let renderer = $state<BackgroundRenderer | null>(null)

  const own = $derived(findPreset(settings.preset).kind === 'media')

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

  // Свой файл рендер не видит — контраст меряем по уменьшенной копии кадра
  $effect(() => {
    if (!own || !media) return
    const probe = document.createElement('canvas')
    probe.width = 96
    probe.height = 54
    const ctx = probe.getContext('2d', { willReadFrequently: true })
    const dim = settings.dim
    const measure = () => {
      const el = mediaEl
      if (!ctx || !el) return
      if (el instanceof HTMLVideoElement && el.readyState < 2) return
      try {
        ctx.drawImage(el, 0, 0, probe.width, probe.height)
        // Центр кадра, где стоит текст: 70% × 50%
        const px = ctx.getImageData(14, 13, 68, 28).data
        onContrast?.(contrastOnBackground(px, 68, 28, dim, 1))
      } catch {
        // Кадр ещё не готов — померим в следующий раз
      }
    }
    measure()
    const id = setInterval(measure, 2000)
    return () => clearInterval(id)
  })

  // Наезд камеры на фото: скорость фона задаёт длительность, 0 — фото стоит
  const kenBurns = $derived(
    settings.speed > 0
      ? `animation: bp3-ken-burns ${Math.round(40 / settings.speed)}s ease-in-out infinite alternate`
      : '',
  )
</script>

<!-- Фон рисуется в доле разрешения и растягивается: для мягких градиентов
     это незаметно, а видеокарта нагружается в разы меньше -->
<div
  class="pointer-events-none absolute inset-0 overflow-hidden"
  style={gain !== 1 ? `filter: brightness(${gain.toFixed(3)})` : ''}
  aria-hidden="true"
>
  <canvas bind:this={glCanvas} class="absolute inset-0 size-full" hidden></canvas>
  <canvas bind:this={flowCanvas} class="absolute inset-0 size-full" hidden></canvas>
  {#if own && media}
    {#if media.kind === 'video'}
      <video
        bind:this={mediaEl}
        src={media.url}
        class="absolute inset-0 size-full object-cover"
        autoplay
        muted
        loop
        playsinline
      ></video>
    {:else}
      <img
        bind:this={mediaEl}
        src={media.url}
        alt=""
        class="absolute inset-0 size-full origin-[40%_40%] object-cover"
        style={kenBurns}
      />
    {/if}
  {/if}
  {#if isAnimated(settings)}
    <div class="absolute inset-0 bg-black" style="opacity: {settings.dim}"></div>
  {/if}
</div>

<style>
  @keyframes -global-bp3-ken-burns {
    from {
      transform: scale(1.04) translate(0, 0);
    }
    to {
      transform: scale(1.18) translate(-2.5%, -1.5%);
    }
  }
</style>
