<script lang="ts">
  import { Search, BookOpen, Music, CornerDownLeft } from '@lucide/svelte'
  import { data } from '../db.svelte'
  import { show } from '../show.svelte'
  import {
    parseQuery,
    searchSongs,
    searchVerses,
    buildVerseIndex,
    hasVerseIndex,
    makeTitleGetter,
    codeForBookId,
    type VerseHit,
  } from '../search'
  // @ts-expect-error legacy JS module without types
  import { getBookTitle } from '../legacy/canonical.js'
  import type { SongRow } from '../db.svelte'

  let query = $state('')
  let open = $state(false)
  let indexing = $state(false)
  let input: HTMLInputElement

  interface RefResult {
    canonicalCode: string
    chapter: number
    verse: number
    label: string
  }

  const parsedRef = $derived.by((): RefResult | null => {
    const parsed = parseQuery(query) as {
      canonicalCode: string
      chapter: string
      verse: string
    } | null
    if (!parsed) return null
    const lang = data.translation === 'KTB' ? 'kz' : data.translation === 'KYB' ? 'ky' : 'ru'
    const title = getBookTitle(parsed.canonicalCode, lang) as string
    const verse = parseInt(parsed.verse.split(/[-,]/)[0]) || 1
    return {
      canonicalCode: parsed.canonicalCode,
      chapter: parseInt(parsed.chapter),
      verse,
      label: `${title} ${parsed.chapter}:${parsed.verse}`,
    }
  })

  const songHits = $derived(query.trim() ? searchSongs(query, data.songs, 5) : [])

  let verseHits = $state<VerseHit[]>([])
  $effect(() => {
    const q = query.trim()
    if (q.length < 3 || parsedRef) {
      verseHits = []
      return
    }
    const translation = data.translation
    const db = data.db
    if (!db) return
    if (!hasVerseIndex(translation)) {
      indexing = true
      // Индекс строится один раз на перевод; отдаём кадр браузеру
      setTimeout(() => {
        buildVerseIndex(translation, db, makeTitleGetter(translation))
        indexing = false
        verseHits = searchVerses(q, translation, 5)
      }, 20)
      return
    }
    verseHits = searchVerses(q, translation, 5)
  })

  const empty = $derived(!parsedRef && !verseHits.length && !songHits.length && !indexing)

  export function focus() {
    input.focus()
  }

  function close() {
    open = false
    query = ''
  }

  function openRef(ref: RefResult, live = false) {
    if (show.loadChapter(ref.canonicalCode, ref.chapter, ref.verse)) {
      if (live) show.go()
      close()
    }
  }

  function openVerseHit(hit: VerseHit, live = false) {
    const code = codeForBookId(data.translation, hit.bookId)
    if (code && show.loadChapter(code, hit.chapter, hit.verse)) {
      if (live) show.go()
      close()
    }
  }

  function openSong(song: SongRow) {
    show.loadSong(song)
    close()
  }

  function onEnter(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false
      input.blur()
      return
    }
    if (e.key !== 'Enter') return
    const live = e.ctrlKey || e.metaKey
    if (parsedRef) openRef(parsedRef, live)
    else if (verseHits.length) openVerseHit(verseHits[0], live)
    else if (songHits.length) openSong(songHits[0])
  }

  const group = 'px-3 pt-2 pb-1 text-2xs font-semibold tracking-wide text-faint uppercase'
  const item = 'flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-hover'
</script>

<div class="relative mx-auto w-full max-w-[560px] flex-1">
  <Search size={13} class="pointer-events-none absolute top-2 left-2.5 text-faint" />
  <input
    bind:this={input}
    bind:value={query}
    oninput={() => (open = query.trim().length > 0)}
    onblur={() => setTimeout(() => (open = false), 150)}
    onkeydown={onEnter}
    type="text"
    placeholder="Стих, песня или текст…"
    autocomplete="off"
    class="h-7 w-full rounded border border-stroke-2 bg-bg pr-14 pl-8 text-sm text-ink
           placeholder:text-faint focus:border-accent focus:outline-none"
  />
  <kbd class="absolute top-1.5 right-2 font-mono text-2xs text-faint">Ctrl K</kbd>

  {#if open}
    <div
      class="absolute top-full right-0 left-0 z-50 mt-1 max-h-[420px] overflow-y-auto rounded-md
             border border-stroke-2 bg-panel-2 pb-1 shadow-xl shadow-black/50"
    >
      {#if parsedRef}
        <div class={group}>Ссылка на стих</div>
        <button class={item} onclick={() => openRef(parsedRef)}>
          <BookOpen size={14} class="shrink-0 text-accent" />
          <span class="min-w-0">
            <span class="text-base font-medium">{parsedRef.label}</span>
            <span class="block text-xs text-faint">{data.translation}</span>
          </span>
          <span class="ml-auto flex items-center gap-1 font-mono text-2xs whitespace-nowrap text-faint">
            <CornerDownLeft size={11} />превью · Ctrl⏎ эфир
          </span>
        </button>
      {/if}

      {#if indexing}
        <div class="px-3 py-2 text-xs text-faint">Индексация перевода…</div>
      {/if}

      {#if verseHits.length}
        <div class={group}>Найдено в Библии · {data.translation}</div>
        {#each verseHits as v (v.id)}
          <button class={item} onclick={() => openVerseHit(v)}>
            <BookOpen size={14} class="shrink-0 text-faint" />
            <span class="min-w-0">
              <span class="text-base font-medium">{v.ref}</span>
              <span class="block truncate text-xs text-muted">{v.text}</span>
            </span>
          </button>
        {/each}
      {/if}

      {#if songHits.length}
        <div class={group}>Песни</div>
        {#each songHits as song (song.id)}
          <button class={item} onclick={() => openSong(song)}>
            <Music size={14} class="shrink-0 text-faint" />
            <span class="min-w-0">
              <span class="text-base font-medium">{song.title}</span>
              <span class="block text-xs text-faint">
                {song.songNumber ? `№ ${song.songNumber}` : 'без номера'}
              </span>
            </span>
          </button>
        {/each}
      {/if}

      {#if empty}
        <div class="px-3 py-2 text-xs text-faint">
          Ничего не найдено — попробуйте «ин 3 16», «благодать», «579»
        </div>
      {/if}
    </div>
  {/if}
</div>
