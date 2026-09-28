<script lang="ts">
  import {
    Music,
    BookOpen,
    History,
    PanelLeftClose,
    PanelLeftOpen,
  } from '@lucide/svelte'
  import LibrarySongs from './LibrarySongs.svelte'
  import LibraryBible from './LibraryBible.svelte'
  import LibraryHistory from './LibraryHistory.svelte'

  /** Левая панель: песни, книги Библии и история эфира; сворачивается в колонку иконок */
  interface Props {
    open: boolean
    onToggle: () => void
  }
  let { open, onToggle }: Props = $props()

  type Tab = 'songs' | 'bible' | 'history'
  let tab = $state<Tab>('songs')

  const TABS = [
    ['songs', 'Песни', Music],
    ['bible', 'Библия', BookOpen],
    ['history', 'История', History],
  ] as const

  /** Иконка на свёрнутой панели: развернуть сразу на нужной вкладке */
  function openTab(key: Tab) {
    tab = key
    onToggle()
  }

  // Состояние вкладок живёт здесь, чтобы не сбрасываться при переключении
  let songFilter = $state('')
  let selectedBook = $state<string | null>(null)
</script>

<aside class="flex min-h-0 flex-col bg-panel" aria-label="Библиотека">
  {#if !open}
    <div class="flex h-9 shrink-0 items-center justify-center border-b border-stroke">
      <button
        class="grid size-7 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
        onclick={onToggle}
        title="Развернуть панель"
        aria-label="Развернуть библиотеку"
      >
        <PanelLeftOpen size={14} />
      </button>
    </div>
    <div class="flex flex-col items-center gap-1 py-1.5">
      {#each TABS as [key, label, Icon] (key)}
        <button
          onclick={() => openTab(key)}
          title={label}
          aria-label={label}
          class="grid size-8 place-items-center rounded {tab === key
            ? 'bg-active text-accent'
            : 'text-faint hover:bg-hover'}"
        >
          <Icon size={15} />
        </button>
      {/each}
    </div>
  {:else}
    <div class="flex h-9 shrink-0 items-stretch border-b border-stroke">
      {#each TABS as [key, label, Icon] (key)}
        <button
          onclick={() => (tab = key)}
          class="flex flex-1 items-center justify-center gap-1.5 border-b-2 text-sm font-medium
                 {tab === key
            ? 'border-accent text-ink'
            : 'border-transparent text-faint hover:text-muted'}"
        >
          <Icon size={13} />{label}
        </button>
      {/each}
      <button
        class="mx-1 grid size-7 shrink-0 place-items-center self-center rounded text-faint hover:bg-hover hover:text-muted"
        onclick={onToggle}
        title="Свернуть панель"
        aria-label="Свернуть библиотеку"
      >
        <PanelLeftClose size={14} />
      </button>
    </div>

    {#if tab === 'songs'}
      <LibrarySongs bind:filter={songFilter} />
    {:else if tab === 'history'}
      <LibraryHistory />
    {:else}
      <LibraryBible bind:selected={selectedBook} />
    {/if}
  {/if}
</aside>
