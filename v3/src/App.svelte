<script lang="ts">
  import { MonitorPlay, Clock4, LoaderCircle } from '@lucide/svelte'
  import Omnibox from './lib/components/Omnibox.svelte'
  import Setlist from './lib/components/Setlist.svelte'
  import Deck from './lib/components/Deck.svelte'
  import SlideGrid from './lib/components/SlideGrid.svelte'
  import Dock from './lib/components/Dock.svelte'
  import Library from './lib/components/Library.svelte'
  import { show } from './lib/show.svelte'
  import { data } from './lib/db.svelte'
  import { setlist } from './lib/setlist.svelte'
  import { ui } from './lib/ui.svelte'
  import { pushSongs, pushBible } from './lib/search-service.svelte'
  import { resolveHotkey } from './lib/hotkeys'

  let omnibox: Omnibox
  let clock = $state('')
  let setlistOpen = $state(true)

  function tick() {
    const d = new Date()
    clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  tick()
  setInterval(tick, 15000)

  $effect(() => {
    data.init().then(() => {
      if (data.status !== 'ready') return
      // Индексация — в Web Worker, главный поток не блокируется
      pushSongs(data.songs)
      // Стартовое наполнение: первый элемент плейлиста, который удаётся открыть
      for (let i = 0; i < setlist.items.length && setlist.currentIdx < 0; i++) {
        setlist.open(i)
      }
    })
  })

  // Отдаём воркеру перевод, как только он загружен/выбран
  $effect(() => {
    pushBible(data.translation, data.bibles[data.translation] ?? null)
  })

  function onKeydown(e: KeyboardEvent) {
    const action = resolveHotkey({
      code: e.code,
      key: e.key,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      target: e.target instanceof Element ? e.target : null,
    })
    if (!action) return
    if (action === 'go' || action === 'focus-search') e.preventDefault()
    if (action === 'focus-search') omnibox.focus()
    else if (action === 'go') show.go()
    else if (action === 'next') show.next()
    else if (action === 'prev') show.prev()
    else if (action === 'blackout') show.toggleBlackout()
    else if (action === 'clear') show.clear()
  }

  // Уведомления о тихих отказах: показываем и гасим через 4 секунды
  $effect(() => {
    if (!ui.lastNotice) return
    const id = setTimeout(() => ui.clearNotice(), 4000)
    return () => clearTimeout(id)
  })
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

  {#if data.status === 'loading'}
    <div class="grid place-items-center">
      <div class="flex items-center gap-2.5 text-base text-muted">
        <LoaderCircle size={18} class="animate-spin text-accent" />
        Загрузка переводов и песен…
      </div>
    </div>
  {:else if data.status === 'error'}
    <div class="grid place-items-center">
      <div class="text-base text-live">Не удалось загрузить данные. Обновите страницу.</div>
    </div>
  {:else}
    <!-- Три зоны -->
    <div
      class="grid min-h-0 divide-x divide-stroke"
      style="grid-template-columns: {setlistOpen ? '264px' : '44px'} 1fr 284px"
    >
      <Setlist open={setlistOpen} onToggle={() => (setlistOpen = !setlistOpen)} />

      <!-- Центр -->
      <section class="flex min-h-0 flex-col bg-bg">
        <div class="grid shrink-0 grid-cols-2 gap-px border-b border-stroke bg-stroke">
          <Deck mode="preview" slide={show.previewSlide} />
          <Deck mode="live" slide={show.liveSlide} blackout={show.blackout} />
        </div>

        <div class="flex shrink-0 items-baseline gap-2 px-3 pt-3 pb-1.5">
          <span class="text-lg font-semibold">{show.title || 'Ничего не выбрано'}</span>
          <span class="text-xs text-faint">
            {show.subtitle}{show.slides.length ? ` · ${show.slides.length} слайдов` : ''}
          </span>
          {#if show.slides.length}
            <span class="ml-auto text-xs text-faint">клик — превью · двойной — эфир</span>
          {/if}
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <SlideGrid />
        </div>

        <Dock />
      </section>

      <Library />
    </div>
  {/if}

  {#if ui.lastNotice}
    <div
      role="status"
      aria-live="polite"
      class="fixed bottom-14 left-1/2 z-50 -translate-x-1/2 rounded-md border border-live/50 bg-panel-2 px-4 py-2 text-sm text-ink shadow-xl shadow-black/50"
    >
      {ui.lastNotice}
    </div>
  {/if}
</div>
