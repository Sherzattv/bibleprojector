<script lang="ts">
  import { Music, BookOpen, History } from '@lucide/svelte'
  import { demoLibrarySongs, demoVerses, demoHistory } from '../data'

  type Tab = 'songs' | 'bible' | 'history'
  let tab = $state<Tab>('songs')

  const tabs: Array<[Tab, string, typeof Music]> = [
    ['songs', 'Песни', Music],
    ['bible', 'Библия', BookOpen],
    ['history', 'История', History],
  ]

  const row =
    'flex w-full items-center gap-2.5 px-3 py-[7px] text-left hover:bg-hover'
</script>

<aside class="flex min-h-0 flex-col bg-panel">
  <div class="flex h-9 shrink-0 items-stretch border-b border-stroke">
    {#each tabs as [key, label, Icon] (key)}
      <button
        onclick={() => (tab = key)}
        class="flex flex-1 items-center justify-center gap-1.5 border-b-2 text-[11.5px] font-medium
               {tab === key
          ? 'border-accent text-ink'
          : 'border-transparent text-faint hover:text-muted'}"
      >
        <Icon size={13} />{label}
      </button>
    {/each}
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto py-1">
    {#if tab === 'songs'}
      {#each demoLibrarySongs as [title, num] (num)}
        <button class={row}>
          <span class="w-8 shrink-0 text-right font-mono text-[10.5px] text-faint tabular-nums">{num}</span>
          <span class="truncate text-[12.5px]">{title}</span>
        </button>
      {/each}
    {:else if tab === 'bible'}
      {#each demoVerses as v (v.ref)}
        <button class={row}>
          <span class="min-w-0">
            <span class="block text-[12.5px] font-medium">{v.ref}</span>
            <span class="block truncate text-[11px] text-faint">{v.text}</span>
          </span>
        </button>
      {/each}
    {:else}
      {#each demoHistory as [title, meta] (title)}
        <button class={row}>
          <span class="min-w-0">
            <span class="block truncate text-[12.5px]">{title}</span>
            <span class="block text-[11px] text-faint">{meta}</span>
          </span>
        </button>
      {/each}
    {/if}
  </div>

  <div class="shrink-0 border-t border-stroke px-3 py-2 text-[11px] text-faint">
    11 524 песни · 4 перевода · офлайн
  </div>
</aside>
