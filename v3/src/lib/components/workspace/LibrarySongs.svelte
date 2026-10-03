<script lang="ts">
  import { data, type SongRow } from '../../data/db.svelte'
  import { commands } from '../../show/commands.svelte'
  import { SONG_LANGS, songLangInfo, type SongLang } from '../../songs/languages'
  import { statusNote } from '../../ui/translation-picker'
  import { countLabel } from '../../utils/format'
  import { foldText } from '../../utils/text'
  import FooterSwitch from './FooterSwitch.svelte'
  import { libraryRow as row } from './library-row'

  /** Каталог песен выбранного языка с быстрым фильтром по названию и номеру */
  interface Props {
    /** Фильтр живёт в Library — переживает переключение вкладок */
    filter: string
  }
  let { filter: songFilter = $bindable() }: Props = $props()

  const langSongs = $derived(data.songsByLang[data.songLang])
  const langStatus = $derived(data.songStatus[data.songLang])

  // Фильтр списка — дешёвая подстрока (полный fuzzy-поиск живёт в омнибоксе)
  const visibleSongs = $derived.by((): SongRow[] => {
    const q = foldText(songFilter.trim())
    if (!q) return langSongs.slice(0, 100)
    return langSongs
      .filter((s) => foldText(s.title).includes(q) || s.songNumber === q)
      .slice(0, 50)
  })

  const langOptions = $derived(
    SONG_LANGS.map((l) => {
      const note = statusNote(data.songStatus[l.code])
      return {
        value: l.code,
        label: l.short,
        title: `Песни: ${l.label}${note ? ` — ${note}` : ''}`,
      }
    }),
  )

  function openSong(song: SongRow) {
    commands.openSong(song.id)
  }

  function pickLang(lang: SongLang) {
    data.setSongLang(lang)
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
    {#if langStatus === 'loading'}
      <div class="px-3 py-4 text-xs text-faint">Загрузка песен…</div>
    {:else if langStatus === 'error'}
      <div class="px-3 py-4 text-xs text-faint">
        Песни «{songLangInfo(data.songLang).label}» не загрузились.
        <button class="text-accent hover:underline" onclick={() => data.retrySongs(data.songLang)}>
          Повторить
        </button>
      </div>
    {:else}
      <div class="px-3 py-4 text-xs text-faint">Ничего не найдено</div>
    {/if}
  {/each}
</div>
<div class="flex h-8 shrink-0 items-center gap-2 border-t border-stroke pr-1.5 pl-3 text-xs text-faint">
  <span class="min-w-0 flex-1 truncate">
    {countLabel(langSongs.length, ['песня', 'песни', 'песен'])}{songFilter.trim()
      ? ` · показано ${visibleSongs.length}`
      : langSongs.length > 100
        ? ' · первые 100'
        : ''}
  </span>
  <FooterSwitch label="Язык песен" options={langOptions} value={data.songLang} onchange={pickLang} />
</div>
