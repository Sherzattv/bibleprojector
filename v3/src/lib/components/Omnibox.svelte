<script lang="ts">
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

  function onInput() {
    open = query.trim().length > 0
  }
</script>

<div class="relative mx-auto w-full max-w-[620px] flex-1">
  <span class="pointer-events-none absolute top-[8px] left-3 text-sm text-faint">⌕</span>
  <input
    bind:this={input}
    bind:value={query}
    oninput={onInput}
    onblur={() => setTimeout(() => (open = false), 150)}
    onkeydown={(e) => e.key === 'Escape' && ((open = false), input.blur())}
    type="text"
    placeholder="Стих, песня или текст…  «ин 3 16» · «579» · «благодать»"
    autocomplete="off"
    class="w-full rounded-xl border border-stroke bg-surface-2 py-2 pr-20 pl-9 text-[13.5px] text-ink
           transition placeholder:text-faint focus:border-accent/60 focus:bg-white/7
           focus:shadow-[0_0_0_4px_rgba(110,139,255,0.12)] focus:outline-none"
  />
  <kbd
    class="absolute top-[7px] right-2.5 rounded-md border border-stroke bg-white/3 px-1.5 py-0.5 font-mono text-[10.5px] text-faint"
  >
    ⌘K
  </kbd>

  {#if open}
    <div
      class="absolute top-[calc(100%+8px)] right-0 left-0 z-50 max-h-[440px] overflow-y-auto rounded-2xl
             border border-stroke-strong bg-[rgba(18,20,26,0.92)] p-2 shadow-2xl shadow-black/60 backdrop-blur-2xl"
    >
      {#if parsedRef}
        <div class="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
          Ссылка на стих
        </div>
        <button class="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-accent-soft">
          <span class="grid size-[30px] shrink-0 place-items-center rounded-lg border border-stroke bg-surface-2 text-[13px]">📖</span>
          <span class="min-w-0">
            <span class="text-[13px] font-medium">{parsedRef}</span>
            <span class="block text-xs text-muted">Синодальный перевод</span>
          </span>
          <span class="ml-auto font-mono text-[10px] whitespace-nowrap text-faint">⏎ превью · ⌘⏎ эфир</span>
        </button>
      {/if}

      {#if verseHits.length}
        <div class="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">
          Найдено в Библии
        </div>
        {#each verseHits as v (v.ref)}
          <button class="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-accent-soft">
            <span class="grid size-[30px] shrink-0 place-items-center rounded-lg border border-stroke bg-surface-2 text-[13px]">📖</span>
            <span class="min-w-0">
              <span class="text-[13px] font-medium">{v.ref}</span>
              <span class="block truncate text-xs text-muted">{v.text}</span>
            </span>
          </button>
        {/each}
      {/if}

      {#if songHits.length}
        <div class="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-faint uppercase">Песни</div>
        {#each songHits as [t, n] (n)}
          <button class="flex w-full items-center gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-accent-soft">
            <span class="grid size-[30px] shrink-0 place-items-center rounded-lg border border-stroke bg-surface-2 text-[13px]">🎵</span>
            <span class="min-w-0">
              <span class="text-[13px] font-medium">{t}</span>
              <span class="block text-xs text-muted">Песня · № {n}</span>
            </span>
          </button>
        {/each}
      {/if}

      {#if empty}
        <div class="px-3 py-3 text-xs text-faint">
          Ничего не найдено — попробуйте «ин 3 16», «благодать», «1000»
        </div>
      {/if}
    </div>
  {/if}
</div>
