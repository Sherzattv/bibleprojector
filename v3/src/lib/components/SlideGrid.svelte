<script lang="ts">
  import { show } from '../show.svelte'
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
  {#each show.slides as slide, i (i)}
    {@const onAir = i === show.liveIdx}
    {@const inPreview = i === show.previewIdx && !onAir}
    <button
      onclick={() => show.setPreview(i)}
      ondblclick={() => show.takeLive(i)}
      onpointerup={(e) => (e.currentTarget as HTMLElement).blur()}
      class="relative aspect-[16/10] overflow-hidden rounded-md border bg-black text-left
             {onAir
        ? 'border-live'
        : inPreview
          ? 'border-accent'
          : 'border-stroke-2 hover:border-faint'}"
    >
      <span
        class="absolute inset-x-0 top-0 bottom-6 grid place-items-center overflow-hidden px-2 py-1.5 text-center font-serif
               text-2xs leading-normal text-white/85"
      >
        <span class="line-clamp-5">
          {#each slide.text.split('\n') as line, li (li)}
            {line}<br />
          {/each}
        </span>
      </span>
      <span
        class="absolute inset-x-0 bottom-0 flex h-6 items-center justify-between border-t px-2 text-2xs font-medium tracking-wide
               {onAir
          ? 'border-live/40 bg-live-dim text-live'
          : inPreview
            ? 'border-accent/40 bg-accent-dim text-accent'
            : 'border-stroke bg-panel text-faint'}"
      >
        <span class="truncate">{slide.label}</span>
        <span class="ml-1 shrink-0 font-mono tabular-nums">
          {onAir ? 'ЭФИР' : inPreview ? 'ПРЕВЬЮ' : String(i + 1).padStart(2, '0')}
        </span>
      </span>
    </button>
  {:else}
    <div class="col-span-full py-10 text-center text-sm text-faint">
      Выберите песню или отрывок — из поиска, библиотеки или плейлиста
    </div>
  {/each}
</div>
