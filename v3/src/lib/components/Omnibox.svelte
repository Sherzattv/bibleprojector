<script lang="ts">
  import { Search, BookOpen, Music, CornerDownLeft } from '@lucide/svelte'
  import { demoVerses, demoLibrarySongs, demoBookMap } from '../data'

  let query = $state('')
  let open = $state(false)
  let input: HTMLInputElement

  const refRe = /^(\d?\s?[а-яёa-z]+)\s+(\d+)(?:[\s:](\d+(?:-\d+)?))?$/i

  const parsedRef = $derived.by(() => {
    const m = query.toLowerCase().replace(/:/g, ' ').trim().match(refRe)
    if (!m) return null
    const book = demoBookMap[m[1].replace(/\s/g, '')]
    if (!book) return null
    return `${book} ${m[2]}${m[3] ? ':' + m[3] : ''}`
  })

  const verseHits = $derived(
    query.trim().length < 3
      ? []
      : demoVerses.filter((v) => v.text.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 3),
  )

  const songHits = $derived.by(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return demoLibrarySongs.filter(([t, n]) => (t + ' ' + n).toLowerCase().includes(q)).slice(0, 3)
  })

  const empty = $derived(!parsedRef && !verseHits.length && !songHits.length)

  export function focus() {
    input.focus()
  }

  const group = 'px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-faint uppercase'
  const item = 'flex w-full items-center gap-2.5 px-3 py-[7px] text-left hover:bg-hover'
</script>

<div class="relative mx-auto w-full max-w-[560px] flex-1">
  <Search size={13} class="pointer-events-none absolute top-[8px] left-2.5 text-faint" />
  <input
    bind:this={input}
    bind:value={query}
    oninput={() => (open = query.trim().length > 0)}
    onblur={() => setTimeout(() => (open = false), 150)}
    onkeydown={(e) => e.key === 'Escape' && ((open = false), input.blur())}
    type="text"
    placeholder="Стих, песня или текст…"
    autocomplete="off"
    class="h-[29px] w-full rounded-[5px] border border-stroke-2 bg-bg pr-14 pl-8 text-[12.5px] text-ink
           placeholder:text-faint focus:border-accent focus:outline-none"
  />
  <kbd class="absolute top-[6px] right-2 font-mono text-[10px] text-faint">Ctrl K</kbd>

  {#if open}
    <div
      class="absolute top-[calc(100%+5px)] right-0 left-0 z-50 max-h-[420px] overflow-y-auto rounded-md
             border border-stroke-2 bg-panel-2 pb-1 shadow-xl shadow-black/50"
    >
      {#if parsedRef}
        <div class={group}>Ссылка на стих</div>
        <button class={item}>
          <BookOpen size={14} class="shrink-0 text-accent" />
          <span class="min-w-0">
            <span class="text-[12.5px] font-medium">{parsedRef}</span>
            <span class="block text-[11px] text-faint">Синодальный перевод</span>
          </span>
          <span class="ml-auto flex items-center gap-1 font-mono text-[10px] whitespace-nowrap text-faint">
            <CornerDownLeft size={11} />превью
          </span>
        </button>
      {/if}

      {#if verseHits.length}
        <div class={group}>Найдено в Библии</div>
        {#each verseHits as v (v.ref)}
          <button class={item}>
            <BookOpen size={14} class="shrink-0 text-faint" />
            <span class="min-w-0">
              <span class="text-[12.5px] font-medium">{v.ref}</span>
              <span class="block truncate text-[11px] text-muted">{v.text}</span>
            </span>
          </button>
        {/each}
      {/if}

      {#if songHits.length}
        <div class={group}>Песни</div>
        {#each songHits as [t, n] (n)}
          <button class={item}>
            <Music size={14} class="shrink-0 text-faint" />
            <span class="min-w-0">
              <span class="text-[12.5px] font-medium">{t}</span>
              <span class="block text-[11px] text-faint">№ {n}</span>
            </span>
          </button>
        {/each}
      {/if}

      {#if empty}
        <div class="px-3 py-2.5 text-[11.5px] text-faint">
          Ничего не найдено — попробуйте «ин 3 16», «благодать», «1000»
        </div>
      {/if}
    </div>
  {/if}
</div>
