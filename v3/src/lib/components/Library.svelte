<script lang="ts">
  import { Music, BookOpen, History, ChevronLeft } from '@lucide/svelte'
  import { data } from '../db.svelte'
  import { commands } from '../commands.svelte'
  import { history, type HistoryEntry } from '../history.svelte'
  import { BOOK_INFO, getBookId } from '../legacy/canonical.js'
  import type { SongRow } from '../db.svelte'

  type Tab = 'songs' | 'bible' | 'history'
  let tab = $state<Tab>('songs')
  let songFilter = $state('')
  let selectedBook = $state<string | null>(null)

  const row = 'flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-hover'

  // Фильтр списка — дешёвая подстрока (полный fuzzy-поиск живёт в омнибоксе)
  const normalize = (s: string) => s.toLowerCase().replace(/ё/g, 'е')
  const visibleSongs = $derived.by((): SongRow[] => {
    const q = normalize(songFilter.trim())
    if (!q) return data.songs.slice(0, 100)
    return data.songs
      .filter((s) => normalize(s.title).includes(q) || s.songNumber === q)
      .slice(0, 50)
  })

  /** Книги, реально существующие в текущем переводе */
  const books = $derived.by(() => {
    const db = data.db
    if (!db) return []
    const lang = data.translation === 'KTB' ? 'kz' : data.translation === 'KYB' ? 'ky' : 'ru'
    return Object.entries(BOOK_INFO)
      .map(([code, info]) => {
        const bookId = getBookId(code, data.translation)
        const book = db.Books.find((b) => b.BookId === bookId)
        if (!book) return null
        return { code, title: info[lang] || info.ru, chapters: book.Chapters.length }
      })
      .filter((b): b is NonNullable<typeof b> => !!b)
  })

  const selectedBookInfo = $derived(books.find((b) => b.code === selectedBook) ?? null)

  function openSong(song: SongRow) {
    commands.openSong(song.id)
  }
  function openChapter(code: string, chapter: number) {
    commands.openRef(code, chapter)
  }
  function reopenHistory(entry: HistoryEntry) {
    const s = entry.source
    if (s.kind === 'song') commands.openSong(s.id)
    else if (s.kind === 'bible') commands.openRef(s.code, s.chapter, s.verse)
    else commands.openNote(s.title, s.text)
  }
  function timeOf(at: number): string {
    const d = new Date(at)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  function historyCountLabel(count: number) {
    const mod100 = count % 100
    const mod10 = count % 10
    const noun =
      mod100 >= 11 && mod100 <= 14
        ? 'показов'
        : mod10 === 1
          ? 'показ'
          : mod10 >= 2 && mod10 <= 4
            ? 'показа'
            : 'показов'
    return `${count} ${noun}`
  }
</script>

<aside class="flex min-h-0 flex-col bg-panel" aria-label="Библиотека">
  <div class="flex h-9 shrink-0 items-stretch border-b border-stroke">
    {#each [['songs', 'Песни', Music], ['bible', 'Библия', BookOpen], ['history', 'История', History]] as const as [key, label, Icon] (key)}
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
  </div>

  {#if tab === 'songs'}
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
  {:else if tab === 'history'}
    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      {#each history.items as entry (entry.at)}
        <button class={row} onclick={() => reopenHistory(entry)}>
          <span class="w-9 shrink-0 text-right font-mono text-xs text-faint tabular-nums">{timeOf(entry.at)}</span>
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
      {historyCountLabel(history.items.length)}
      {#if history.items.length}
        <button class="hover:text-muted" onclick={() => history.clear()}>Очистить</button>
      {/if}
    </div>
  {:else if selectedBookInfo}
    <button
      class="flex h-8 shrink-0 items-center gap-1.5 border-b border-stroke px-3 text-sm font-medium text-accent hover:bg-hover"
      onclick={() => (selectedBook = null)}
    >
      <ChevronLeft size={13} />{selectedBookInfo.title}
    </button>
    <div class="min-h-0 flex-1 overflow-y-auto p-2">
      <div class="grid grid-cols-6 gap-1">
        {#each Array.from({ length: selectedBookInfo.chapters }, (_, n) => n + 1) as n (n)}
          <button
            class="grid h-8 place-items-center rounded border border-stroke-2 font-mono text-sm text-muted tabular-nums
                   hover:border-accent hover:text-ink"
            onclick={() => openChapter(selectedBookInfo.code, n)}
          >
            {n}
          </button>
        {/each}
      </div>
    </div>
  {:else}
    <div class="min-h-0 flex-1 overflow-y-auto py-1">
      {#each books as book (book.code)}
        <button class={row} onclick={() => (selectedBook = book.code)}>
          <span class="truncate text-base">{book.title}</span>
          <span class="ml-auto shrink-0 font-mono text-xs text-faint tabular-nums">{book.chapters}</span>
        </button>
      {/each}
    </div>
    <div class="flex h-8 shrink-0 items-center border-t border-stroke px-3 text-xs text-faint">
      {books.length} книг · {data.translation}{data.demo ? ' · демо-данные' : ''}
    </div>
  {/if}
</aside>
