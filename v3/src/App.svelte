<script lang="ts">
  import { MonitorPlay, Clock4 } from '@lucide/svelte'
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

<div class="grid h-screen grid-rows-[48px_1fr]">
  <!-- Верхняя панель -->
  <header class="z-30 flex h-12 items-center gap-4 border-b border-stroke bg-panel px-3">
    <div class="flex items-center gap-2 text-base font-semibold">
      <MonitorPlay size={16} class="text-accent" />
      Bible Projector
    </div>

    <Omnibox bind:this={omnibox} />

    <div class="ml-auto flex items-center gap-4">
      <span class="flex items-center gap-1.5 text-sm text-muted">
        <span class="size-1.5 rounded-full bg-go"></span>
        Проектор · экран 2
      </span>
      <span class="flex items-center gap-1.5 font-mono text-sm text-faint tabular-nums">
        <Clock4 size={12} />{clock}
      </span>
    </div>
  </header>

  <!-- Три зоны -->
  <div class="grid min-h-0 grid-cols-[264px_1fr_284px] divide-x divide-stroke">
    <Setlist />

    <!-- Центр -->
    <section class="flex min-h-0 flex-col bg-bg">
      <div class="grid shrink-0 grid-cols-2 gap-px border-b border-stroke bg-stroke">
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

      <div class="flex shrink-0 items-baseline gap-2 px-3 pt-3 pb-1.5">
        <span class="text-lg font-semibold">{show.song.title}</span>
        <span class="text-xs text-faint">№ {show.song.num} · {show.song.slides.length} слайда</span>
        <span class="ml-auto text-xs text-faint">клик — превью · двойной — эфир</span>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <SlideGrid />
      </div>

      <Dock />
    </section>

    <Library />
  </div>
</div>
