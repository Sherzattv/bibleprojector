<script lang="ts">
  import { Search, BookOpen, Music, CornerDownLeft, LoaderCircle } from '@lucide/svelte'
  import { data } from '../db.svelte'
  import { commands } from '../commands.svelte'
  import { parseQuery, codeForBookId, pickEnterAction, type VerseHit } from '../search'
  import { getSearchClient } from '../search-service.svelte'
  import { ui } from '../ui.svelte'
  // @ts-expect-error legacy JS module without types
  import { getBookTitle } from '../legacy/canonical.js'
  import type { SongRow } from '../db.svelte'

  let query = $state('')
  let open = $state(false)
  let input: HTMLInputElement

  const client = getSearchClient()

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

  // Поиск уходит в Web Worker (debounce внутри клиента);
  // распознанная ссылка — не повод искать полнотекстом
  $effect(() => {
    client.search(parsedRef ? '' : query, data.translation)
  })

  const songHits = $derived(client.results.songs)
  const verseHits = $derived(client.results.verses)
  const empty = $derived(!parsedRef && !verseHits.length && !songHits.length && !client.indexing)

  export function focus() {
    input.focus()
  }

  function close() {
    open = false
    query = ''
    client.search('', data.translation)
  }

  function openRef(ref: RefResult, live = false) {
    if (commands.openRef(ref.canonicalCode, ref.chapter, ref.verse)) {
      if (live) commands.go()
      close()
    }
  }

  function openVerseHit(hit: VerseHit) {
    const code = codeForBookId(data.translation, hit.bookId)
    if (code && commands.openRef(code, hit.chapter, hit.verse)) {
      close()
    } else if (!code) {
      ui.notify(`«${hit.ref}» не удалось открыть`)
    }
  }

  function openSong(song: SongRow) {
    if (commands.openSong(song.id)) close()
  }

  function onEnter(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false
      input.blur()
      return
    }
    if (e.key !== 'Enter') return
    client.flush()
    // В эфир по Ctrl+Enter уходит только точная ссылка — fuzzy никогда
    const action = pickEnterAction({
      parsedRef,
      verseHits,
      songHits,
      withModifier: e.ctrlKey || e.metaKey,
    })
    if (!action) return
    if (action.type === 'ref') openRef(parsedRef!, action.live)
    else if (action.type === 'verse') openVerseHit(verseHits[0])
    else openSong(songHits[0])
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
            <CornerDownLeft size={11} />превью · Ctrl⏎ в эфир
          </span>
        </button>
      {/if}

      {#if client.indexing}
        <div class="flex items-center gap-2 px-3 py-2 text-xs text-faint">
          <LoaderCircle size={12} class="animate-spin" />Индексация перевода…
        </div>
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
