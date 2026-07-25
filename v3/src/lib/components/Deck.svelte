<script lang="ts">
  import type { ShowSlide } from '../show.svelte'

  interface Props {
    mode: 'preview' | 'live'
    slide: ShowSlide | null
    blackout?: boolean
  }
  let { mode, slide, blackout = false }: Props = $props()
  const isLive = mode === 'live'
</script>

<div class="bg-bg p-3">
  <div class="mb-1.5 flex items-center justify-between">
    <span class="text-xs font-semibold tracking-wide uppercase {isLive ? 'text-live' : 'text-muted'}">
      {isLive ? 'Эфир' : 'Превью'}
    </span>
    {#if isLive}
      <span class="flex items-center gap-1.5 text-xs font-medium {slide || blackout ? 'text-live' : 'text-faint'}">
        {#if slide || blackout}<span class="size-1.5 rounded-full bg-live"></span>{/if}
        {blackout ? 'blackout' : slide ? 'идёт показ' : 'пусто'}
      </span>
    {:else}
      <span class="text-xs text-faint">{slide ? slide.label.toLowerCase() : '—'}</span>
    {/if}
  </div>

  <div
    class="projection relative grid aspect-video place-items-center overflow-hidden rounded-md border p-[5%] text-center
           {isLive && slide ? 'border-live/60' : 'border-stroke-2'}"
  >
    {#if !blackout && slide}
      <div class="max-w-[94%]">
        <div class="font-serif text-[clamp(12px,1.3vw,18px)] leading-[1.55] text-balance text-white">
          {#each slide.text.split('\n') as line, i (i)}
            {line}<br />
          {/each}
        </div>
        <div class="mt-2 text-[clamp(9px,0.75vw,11px)] text-amber">
          {slide.reference}
        </div>
      </div>
    {/if}
  </div>
</div>
