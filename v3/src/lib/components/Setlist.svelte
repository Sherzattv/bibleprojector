<script lang="ts">
  import { demoSetlist } from '../data'

  const icons = { song: '🎵', verse: '📖', note: '📝' } as const
  let currentIdx = $state(2)
</script>

<aside class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-stroke bg-surface">
  <div class="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
    <span class="text-[12.5px] font-semibold">Порядок служения</span>
    <button
      class="rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-medium text-accent-2 transition hover:bg-accent/25"
    >
      + Добавить
    </button>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto pb-2">
    {#each demoSetlist as item, i (i)}
      <button
        onclick={() => (currentIdx = i)}
        class="group mx-2 my-0.5 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition
               {i === currentIdx
          ? 'bg-gradient-to-r from-accent/16 to-accent/5 shadow-[inset_0_0_0_1px_rgba(110,139,255,0.35)]'
          : 'hover:bg-surface-2'}"
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-[9px] text-[13px]
                 {i === currentIdx ? 'bg-accent/20' : 'bg-surface-2'}"
        >
          {icons[item.kind]}
        </span>
        <span class="min-w-0">
          <span class="block truncate text-[13px] font-medium">{item.title}</span>
          <span class="block text-[11px] text-faint">{item.meta}</span>
        </span>
        <span class="ml-auto text-xs text-faint opacity-0 transition group-hover:opacity-70">⋮⋮</span>
      </button>
    {/each}

    <button
      class="mx-4 mt-2 w-[calc(100%-32px)] rounded-xl border-[1.5px] border-dashed border-white/12 p-3 text-center
             text-xs text-faint transition hover:border-white/25 hover:text-muted"
    >
      Перетащите сюда стих или песню
    </button>
  </div>
</aside>
