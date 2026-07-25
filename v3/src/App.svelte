<script lang="ts">
  import Omnibox from './lib/components/Omnibox.svelte'
  import Setlist from './lib/components/Setlist.svelte'
  import Deck from './lib/components/Deck.svelte'
  import SlideGrid from './lib/components/SlideGrid.svelte'
  import Dock from './lib/components/Dock.svelte'
  import Library from './lib/components/Library.svelte'
  import { show } from './lib/show.svelte'

  let omnibox: Omnibox
  let clock = $state('')

  function tick() {
    const d = new Date()
    clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  tick()
  setInterval(tick, 15000)

  function onKeydown(e: KeyboardEvent) {
    const typing = (e.target as HTMLElement)?.tagName === 'INPUT'
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      omnibox.focus()
      return
    }
    if (typing) return
    if (e.code === 'Space') {
      e.preventDefault()
      show.go()
    } else if (e.key === 'ArrowRight') show.next()
    else if (e.key === 'ArrowLeft') show.prev()
    else if (e.key.toLowerCase() === 'b' || e.key.toLowerCase() === 'и') show.toggleBlackout()
    else if (e.key === 'Escape') show.clear()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="grid h-screen grid-rows-[54px_1fr]">
  <!-- Верхняя панель -->
  <header
    class="z-30 flex items-center gap-4 border-b border-stroke bg-[rgba(12,14,18,0.6)] px-4 backdrop-blur-xl"
  >
    <div class="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
      <span
        class="grid size-[26px] place-items-center rounded-lg bg-gradient-to-br from-[#4c6fff] to-[#8a5cf6] text-[13px]
               shadow-[0_4px_14px_rgba(90,110,255,0.35)]">📖</span>
      Bible Projector
      <span class="self-start pt-0.5 text-[10.5px] font-medium text-faint">3.0</span>
    </div>

    <Omnibox bind:this={omnibox} />

    <div class="ml-auto flex items-center gap-3">
      <span
        class="flex items-center gap-2 rounded-full border border-stroke bg-surface py-1 pr-3.5 pl-2.5 text-xs font-medium text-muted"
      >
        <span class="size-[7px] rounded-full bg-go shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span>
        Проектор · экран 2
      </span>
      <span class="font-mono text-[12.5px] text-muted tabular-nums">{clock}</span>
    </div>
  </header>

  <!-- Три зоны -->
  <div class="grid min-h-0 grid-cols-[272px_1fr_296px] gap-3 p-3">
    <Setlist />

    <!-- Центр -->
    <section class="flex min-h-0 flex-col gap-3">
      <div class="grid shrink-0 grid-cols-2 gap-3">
        <Deck
          mode="preview"
          text={show.previewSlide.text}
          reference={`${show.song.title} · ${show.previewSlide.label}`}
        />
        <Deck
          mode="live"
          text={show.liveSlide.text}
          reference={`${show.song.title} · ${show.liveSlide.label}`}
          blackout={show.blackout}
          cleared={show.cleared}
        />
      </div>

      <div class="flex min-h-0 flex-1 flex-col rounded-2xl border border-stroke bg-surface px-3 pt-3 pb-2.5">
        <div class="flex shrink-0 items-baseline gap-2.5 px-1 pb-2">
          <span class="text-[14px] font-semibold tracking-tight">{show.song.title}</span>
          <span class="text-[11.5px] text-faint">№ {show.song.num} · клик — в превью, двойной клик — в эфир</span>
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <SlideGrid />
        </div>
        <Dock />
      </div>
    </section>

    <Library />
  </div>
</div>
