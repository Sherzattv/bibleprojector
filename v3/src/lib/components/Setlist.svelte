<script lang="ts">
  import { Music, BookOpen, StickyNote, Plus, GripVertical } from '@lucide/svelte'
  import { demoSetlist } from '../data'

  const icons = { song: Music, verse: BookOpen, note: StickyNote } as const
  let currentIdx = $state(2)
</script>

<aside class="flex min-h-0 flex-col bg-panel">
  <div class="flex h-9 shrink-0 items-center justify-between border-b border-stroke px-3">
    <span class="text-xs font-semibold tracking-wide text-muted uppercase">Порядок служения</span>
    <button class="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
      <Plus size={13} />Добавить
    </button>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto py-1">
    {#each demoSetlist as item, i (i)}
      {@const Icon = icons[item.kind]}
      <button
        onclick={() => (currentIdx = i)}
        class="group flex w-full items-center gap-2.5 border-l-2 px-3 py-1.5 text-left
               {i === currentIdx
          ? 'border-accent bg-active'
          : 'border-transparent hover:bg-hover'}"
      >
        <Icon size={15} class={i === currentIdx ? 'shrink-0 text-accent' : 'shrink-0 text-faint'} />
        <span class="min-w-0">
          <span class="block truncate text-base font-medium">{item.title}</span>
          <span class="block text-xs text-faint">{item.meta}</span>
        </span>
        <GripVertical size={13} class="ml-auto shrink-0 text-faint opacity-0 group-hover:opacity-60" />
      </button>
    {/each}
  </div>

  <div class="flex h-8 shrink-0 items-center border-t border-stroke px-3 text-xs text-faint">
    6 элементов · служение 19:00
  </div>
</aside>
