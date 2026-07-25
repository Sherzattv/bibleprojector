<script lang="ts">
  import {
    Music,
    BookOpen,
    StickyNote,
    Plus,
    GripVertical,
    PanelLeftClose,
    PanelLeftOpen,
  } from '@lucide/svelte'
  import { setlist } from '../setlist.svelte'

  interface Props {
    open: boolean
    onToggle: () => void
  }
  let { open, onToggle }: Props = $props()

  const icons = { song: Music, bible: BookOpen, note: StickyNote } as const
</script>

<aside class="flex min-h-0 flex-col bg-panel">
  {#if open}
    <div class="flex h-9 shrink-0 items-center justify-between border-b border-stroke pr-1 pl-3">
      <span class="text-xs font-semibold tracking-wide text-muted uppercase">Порядок служения</span>
      <span class="flex items-center gap-0.5">
        <button class="flex items-center gap-1 px-1.5 text-sm font-medium text-accent hover:underline">
          <Plus size={13} />Добавить
        </button>
        <button
          class="grid size-7 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
          onclick={onToggle}
          title="Свернуть панель"
        >
          <PanelLeftClose size={14} />
        </button>
      </span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      {#each setlist.items as item, i (i)}
        {@const Icon = icons[item.kind]}
        <button
          onclick={() => setlist.open(i)}
          class="group flex w-full items-center gap-2.5 border-l-2 px-3 py-1.5 text-left
                 {i === setlist.currentIdx
            ? 'border-accent bg-active'
            : 'border-transparent hover:bg-hover'}"
        >
          <Icon size={15} class={i === setlist.currentIdx ? 'shrink-0 text-accent' : 'shrink-0 text-faint'} />
          <span class="min-w-0">
            <span class="block truncate text-base font-medium">{item.title}</span>
            <span class="block text-xs text-faint">
              {item.kind === 'song' ? `Песня · № ${item.num}` : item.kind === 'bible' ? 'Библия' : 'Заметка'}
            </span>
          </span>
          <GripVertical size={13} class="ml-auto shrink-0 text-faint opacity-0 group-hover:opacity-60" />
        </button>
      {/each}
    </div>

    <div class="flex h-8 shrink-0 items-center border-t border-stroke px-3 text-xs text-faint">
      {setlist.items.length} элементов
    </div>
  {:else}
    <div class="flex h-9 shrink-0 items-center justify-center border-b border-stroke">
      <button
        class="grid size-7 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
        onclick={onToggle}
        title="Развернуть панель"
      >
        <PanelLeftOpen size={14} />
      </button>
    </div>
    <div class="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-1.5">
      {#each setlist.items as item, i (i)}
        {@const Icon = icons[item.kind]}
        <button
          onclick={() => setlist.open(i)}
          title={item.title}
          class="grid size-8 shrink-0 place-items-center rounded
                 {i === setlist.currentIdx ? 'bg-active text-accent' : 'text-faint hover:bg-hover'}"
        >
          <Icon size={15} />
        </button>
      {/each}
    </div>
  {/if}
</aside>
