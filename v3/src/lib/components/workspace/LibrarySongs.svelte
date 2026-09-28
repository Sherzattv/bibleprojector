<script lang="ts">
  import { data, type SongRow } from '../../data/db.svelte'
  import { commands } from '../../show/commands.svelte'
  import { foldText } from '../../utils/text'
  import { libraryRow as row } from './library-row'

  /** Каталог песен с быстрым фильтром по названию и номеру */
  interface Props {
    /** Фильтр живёт в Library — переживает переключение вкладок */
    filter: string
  }
  let { filter: songFilter = $bindable() }: Props = $props()

  // Фильтр списка — дешёвая подстрока (полный fuzzy-поиск живёт в омнибоксе)
  const visibleSongs = $derived.by((): SongRow[] => {
    const q = foldText(songFilter.trim())
    if (!q) return data.songs.slice(0, 100)
    return data.songs
      .filter((s) => foldText(s.title).includes(q) || s.songNumber === q)
      .slice(0, 50)
  })

  function openSong(song: SongRow) {
    commands.openSong(song.id)
  }
</script>

<div class="shrink-0 border-b border-stroke p-2">
  <input
    bind:value={songFilter}
    type="text"
    placeholder="Название, номер или строчка…"
    class="h-7 w-full rounded border border-stroke-2 bg-bg px-2.5 text-sm text-ink
           placeholder:text-faint focus:border-accent focus:outline-none"
  />
</div>
<div class="min-h-0 flex-1 overflow-y-auto py-1">
  {#each visibleSongs as song (song.id)}
    <button class={row} onclick={() => openSong(song)}>
      <span class="w-8 shrink-0 text-right font-mono text-xs text-faint tabular-nums">
        {song.songNumber ?? '—'}
      </span>
      <span class="truncate text-base">{song.title}</span>
    </button>
  {:else}
    <div class="px-3 py-4 text-xs text-faint">Ничего не найдено</div>
  {/each}
</div>
<div class="flex h-8 shrink-0 items-center border-t border-stroke px-3 text-xs text-faint">
  {data.songs.length} песен{songFilter.trim() ? ` · показано ${visibleSongs.length}` : data.songs.length > 100 ? ' · первые 100' : ''}
</div>
