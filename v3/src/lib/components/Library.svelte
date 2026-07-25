<script lang="ts">
  import { demoLibrarySongs, demoVerses, demoHistory } from '../data'

  type Tab = 'songs' | 'bible' | 'history'
  let tab = $state<Tab>('songs')

  const tabs: Array<[Tab, string]> = [
    ['songs', 'Песни'],
    ['bible', 'Библия'],
    ['history', 'История'],
  ]
</script>

<aside class="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-stroke bg-surface">
  <div class="flex shrink-0 items-center justify-between px-4 pt-3 pb-2">
    <span class="text-[12.5px] font-semibold">Библиотека</span>
  </div>

  <div class="mx-3 mb-2 flex shrink-0 gap-0.5 rounded-[11px] border border-stroke bg-black/30 p-[3px]">
    {#each tabs as [key, label] (key)}
      <button
        onclick={() => (tab = key)}
        class="flex-1 rounded-lg py-1.5 text-xs font-medium transition
               {tab === key ? 'bg-surface-3 text-ink shadow-md shadow-black/30' : 'text-muted hover:text-ink'}"
      >
        {label}
      </button>
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto pb-2">
    {#if tab === 'songs'}
      {#each demoLibrarySongs as [title, num] (num)}
        <button class="mx-2 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition hover:bg-surface-2">
          <span class="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] text-faint tabular-nums">{num}</span>
          <span class="truncate text-[12.5px] font-medium">{title}</span>
        </button>
      {/each}
    {:else if tab === 'bible'}
      {#each demoVerses as v (v.ref)}
        <button class="mx-2 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition hover:bg-surface-2">
          <span class="shrink-0 text-[13px]">📖</span>
          <span class="min-w-0">
            <span class="block text-[12.5px] font-medium">{v.ref}</span>
            <span class="block truncate text-[11px] text-faint">{v.text}</span>
          </span>
        </button>
      {/each}
    {:else}
      {#each demoHistory as [title, meta] (title)}
        <button class="mx-2 flex w-[calc(100%-16px)] items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left transition hover:bg-surface-2">
          <span class="shrink-0 text-[12px] text-faint">↺</span>
          <span class="min-w-0">
            <span class="block truncate text-[12.5px] font-medium">{title}</span>
            <span class="block text-[11px] text-faint">{meta}</span>
          </span>
        </button>
      {/each}
    {/if}
  </div>
</aside>
