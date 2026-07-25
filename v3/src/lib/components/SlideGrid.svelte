<script lang="ts">
  import { show } from '../show.svelte'
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(168px,1fr))] gap-2">
  {#each show.song.slides as slide, i (i)}
    {@const onAir = i === show.liveIdx}
    {@const inPreview = i === show.previewIdx && !onAir}
    <button
      onclick={() => show.setPreview(i)}
      ondblclick={() => show.takeLive(i)}
      class="relative aspect-[16/10] overflow-hidden rounded-md border bg-black text-left
             {onAir
        ? 'border-live'
        : inPreview
          ? 'border-accent'
          : 'border-stroke-2 hover:border-faint'}"
    >
      <span
        class="absolute inset-x-0 top-0 bottom-[22px] grid place-items-center px-2.5 py-1.5 text-center font-serif
               text-[10px] leading-[1.45] text-white/85"
      >
        <span>
          {#each slide.text.split('\n') as line, li (li)}
            {line}<br />
          {/each}
        </span>
      </span>
      <span
        class="absolute inset-x-0 bottom-0 flex h-[22px] items-center justify-between border-t px-2 text-[10px] font-medium
               {onAir
          ? 'border-live/40 bg-live-dim text-live'
          : inPreview
            ? 'border-accent/40 bg-accent-dim text-accent'
            : 'border-stroke bg-panel text-faint'}"
      >
        <span>{slide.label}</span>
        <span class="font-mono text-[9.5px] tabular-nums">
          {onAir ? 'ЭФИР' : inPreview ? 'ПРЕВЬЮ' : String(i + 1).padStart(2, '0')}
        </span>
      </span>
    </button>
  {/each}
</div>
