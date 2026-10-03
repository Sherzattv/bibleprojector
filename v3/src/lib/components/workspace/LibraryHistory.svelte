<script lang="ts">
  import { commands } from '../../show/commands.svelte'
  import { history, type HistoryEntry } from '../../show/history.svelte'
  import { countLabel, formatClock } from '../../utils/format'
  import { libraryRow as row } from './library-row'

  /** Всё, что уходило в эфир, — для быстрого повтора */
  function reopenHistory(entry: HistoryEntry) {
    commands.openSource(entry.source, entry.reference)
  }
</script>

<div class="min-h-0 flex-1 overflow-y-auto py-1">
  {#each history.items as entry (entry.at)}
    <button class={row} onclick={() => reopenHistory(entry)}>
      <span class="w-9 shrink-0 text-right font-mono text-xs text-faint tabular-nums">{formatClock(entry.at)}</span>
      <span class="min-w-0">
        <span class="block truncate text-base">{entry.reference}</span>
      </span>
    </button>
  {:else}
    <div class="px-3 py-4 text-xs text-faint">
      Здесь появится всё, что уходило в эфир — для быстрого повтора
    </div>
  {/each}
</div>
<div class="flex h-8 shrink-0 items-center justify-between border-t border-stroke px-3 text-xs text-faint">
  {countLabel(history.items.length, ['показ', 'показа', 'показов'])}
  {#if history.items.length}
    <button class="hover:text-muted" onclick={() => history.clear()}>Очистить</button>
  {/if}
</div>
