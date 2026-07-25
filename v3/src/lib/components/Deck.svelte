<script lang="ts">
  interface Props {
    mode: 'preview' | 'live'
    text: string
    reference: string
    blackout?: boolean
    cleared?: boolean
  }
  let { mode, text, reference, blackout = false, cleared = false }: Props = $props()
  const isLive = mode === 'live'
</script>

<div class="bg-bg p-3 pb-2.5">
  <div class="mb-1.5 flex items-center justify-between px-0.5">
    <span class="text-[10.5px] font-semibold tracking-[0.08em] uppercase {isLive ? 'text-live' : 'text-muted'}">
      {isLive ? 'Эфир' : 'Превью'}
    </span>
    {#if isLive}
      <span class="flex items-center gap-1.5 text-[10.5px] font-medium text-live">
        <span class="size-1.5 rounded-full bg-live"></span>
        {blackout ? 'blackout' : cleared ? 'пусто' : 'идёт показ'}
      </span>
    {:else}
      <span class="text-[10.5px] text-faint">следующий</span>
    {/if}
  </div>

  <div
    class="projection relative grid aspect-video place-items-center overflow-hidden rounded-md border p-[5%] text-center
           {isLive ? 'border-live/60' : 'border-stroke-2'}"
  >
    {#if blackout && isLive}
      <!-- чёрный экран: ничего -->
    {:else if !(cleared && isLive)}
      <div class="max-w-[94%]">
        <div class="font-serif text-[clamp(12px,1.3vw,18px)] leading-[1.55] text-balance text-white">
          {#each text.split('\n') as line, i (i)}
            {line}<br />
          {/each}
        </div>
        <div class="mt-2 text-[clamp(9px,0.75vw,11px)] text-amber">
          {reference}
        </div>
      </div>
    {/if}
  </div>
</div>
