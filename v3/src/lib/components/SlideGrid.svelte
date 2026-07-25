<script lang="ts">
  import { show } from '../show.svelte'
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-2.5 px-1 pt-0.5 pb-2">
  {#each show.song.slides as slide, i (i)}
    {@const onAir = i === show.liveIdx}
    {@const inPreview = i === show.previewIdx && !onAir}
    <button
      onclick={() => show.setPreview(i)}
      ondblclick={() => show.takeLive(i)}
      class="slide-thumb relative aspect-[16/10] overflow-hidden rounded-xl border text-left
             transition duration-150 will-change-transform
             {onAir
        ? 'border-live/70 shadow-[0_0_0_1px_rgba(255,82,87,0.4),0_8px_24px_rgba(255,60,60,0.12)]'
        : inPreview
          ? 'border-accent/70 shadow-[0_0_0_1px_rgba(110,139,255,0.4),0_8px_24px_rgba(70,100,255,0.12)]'
          : 'border-stroke hover:-translate-y-0.5 hover:border-stroke-strong hover:shadow-xl hover:shadow-black/40'}"
    >
      <span
        class="absolute inset-x-0 top-0 bottom-[24px] grid place-items-center px-3 py-2 text-center font-serif
               text-[10.5px] leading-[1.5] text-[rgba(240,244,252,0.88)]"
      >
        <span>
          {#each slide.text.split('\n') as line, li (li)}
            {line}<br />
          {/each}
        </span>
      </span>
      <span
        class="absolute inset-x-0 bottom-0 flex h-6 items-center justify-between border-t border-stroke bg-white/3 px-2.5
               text-[9.5px] font-bold tracking-[0.1em] uppercase
               {onAir ? 'text-live' : inPreview ? 'text-accent-2' : 'text-faint'}"
      >
        <span>{slide.label}</span>
        {#if onAir}
          <span class="inline-flex items-center gap-1">
            <span class="pulse-dot size-[5px] rounded-full bg-live"></span>Эфир
          </span>
        {:else if inPreview}
          <span>Превью</span>
        {:else}
          <span class="font-mono">{String(i + 1).padStart(2, '0')}</span>
        {/if}
      </span>
    </button>
  {/each}
</div>
