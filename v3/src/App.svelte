<script lang="ts">
  import {
    MonitorPlay,
    Clock4,
    LoaderCircle,
    Settings2,
    PanelLeft,
    RotateCw,
    Library as LibraryIcon,
  } from '@lucide/svelte'
  import Omnibox from './lib/components/Omnibox.svelte'
  import Setlist from './lib/components/Setlist.svelte'
  import Deck from './lib/components/Deck.svelte'
  import SlideGrid from './lib/components/SlideGrid.svelte'
  import Dock from './lib/components/Dock.svelte'
  import Library from './lib/components/Library.svelte'
  import ProjectorControls from './lib/components/ProjectorControls.svelte'
  import { show } from './lib/show.svelte'
  import { data } from './lib/db.svelte'
  import { setlist } from './lib/setlist.svelte'
  import { ui } from './lib/ui.svelte'
  import { commands } from './lib/commands.svelte'
  import { projSettings } from './lib/proj-settings.svelte'
  import { buildContent } from './lib/projection'
  import { getProjectorLink } from './lib/projector-service.svelte'
  import { pushSongs, pushBible } from './lib/search-service.svelte'
  import { resolveHotkey } from './lib/hotkeys'

  let omnibox = $state<Omnibox>()
  let clock = $state('')
  let setlistOpen = $state(true)
  let settingsOpen = $state(false)
  let mobilePanel = $state<'setlist' | 'library' | null>(null)
  let compactLayout = $state(false)
  let retrying = $state(false)

  const projector = getProjectorLink()

  function tick() {
    const d = new Date()
    clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  tick()
  $effect(() => {
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  })

  $effect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const syncLayout = () => {
      compactLayout = media.matches
      if (!media.matches) mobilePanel = null
    }
    syncLayout()
    media.addEventListener('change', syncLayout)
    return () => media.removeEventListener('change', syncLayout)
  })

  // Всё, что делается после успешной загрузки данных —
  // общее для первого старта и для повтора по кнопке
  function afterDataReady() {
    if (data.status !== 'ready') return
    // Индексация — в Web Worker, главный поток не блокируется
    pushSongs(data.songs)
    // Стартовое наполнение: первый элемент плейлиста, который удаётся открыть
    for (let i = 0; i < setlist.items.length && setlist.currentIdx < 0; i++) {
      setlist.open(i)
    }
    ui.clearNotice()
  }

  $effect(() => {
    data.init().then(afterDataReady)
  })

  // Провал стартовой загрузки — не тупик: обновление страницы часто не помогает,
  // поэтому даём повтор прямо в экране ошибки
  async function retryLoad() {
    if (retrying) return
    retrying = true
    try {
      await data.retryInit()
      afterDataReady()
    } finally {
      retrying = false
    }
  }

  // Отдаём воркеру перевод, как только он загружен/выбран
  $effect(() => {
    pushBible(data.translation, data.bibles[data.translation] ?? null)
  })

  // Любое изменение эфира или настроек мгновенно уезжает на экран проектора
  $effect(() => {
    projector.sendState(
      buildContent({ blackout: show.blackout, kind: show.kind, liveSlide: show.liveSlide }),
      { fontScale: projSettings.fontScale, showReference: projSettings.showReference },
    )
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
    if (action === 'focus-search') omnibox?.focus()
    else if (action === 'go') commands.go()
    else if (action === 'next') commands.next()
    else if (action === 'prev') commands.prev()
    else if (action === 'blackout') commands.toggleBlackout()
    else if (action === 'clear') commands.clearLive()
  }

  // Уведомления о тихих отказах: показываем и гасим через 4 секунды
  $effect(() => {
    if (!ui.lastNotice) return
    const id = setTimeout(() => ui.clearNotice(), 4000)
    return () => clearTimeout(id)
  })

  function toggleSetlist() {
    if (compactLayout) {
      mobilePanel = mobilePanel === 'setlist' ? null : 'setlist'
    } else {
      setlistOpen = !setlistOpen
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-shell grid h-screen grid-rows-[48px_1fr]">
  <!-- Верхняя панель -->
  <header class="app-header z-30 flex h-12 items-center gap-3 border-b border-stroke bg-panel px-3">
    <button
      class="mobile-panel-toggle grid size-7 shrink-0 place-items-center rounded border border-stroke-2 text-muted"
      onclick={() => (mobilePanel = mobilePanel === 'setlist' ? null : 'setlist')}
      aria-label={mobilePanel === 'setlist' ? 'Закрыть порядок служения' : 'Открыть порядок служения'}
      aria-expanded={mobilePanel === 'setlist'}
    ><PanelLeft size={14} /></button>

    <div class="app-brand flex shrink-0 items-center gap-2 text-base font-semibold">
      <MonitorPlay size={16} class="text-accent" />
      <span>Bible Projector</span>
    </div>

    <Omnibox bind:this={omnibox} />

    <div class="app-actions ml-auto flex shrink-0 items-center gap-2.5">
      <ProjectorControls />

      <div class="relative">
        <button
          onclick={() => (settingsOpen = !settingsOpen)}
          class="grid size-7 place-items-center rounded border border-stroke-2 bg-panel-2 text-muted hover:bg-hover hover:text-ink
                 {settingsOpen ? 'border-accent text-ink' : ''}"
          title="Настройки проекции"
          aria-label="Настройки проекции"
          aria-expanded={settingsOpen}
        >
          <Settings2 size={13} />
        </button>
        {#if settingsOpen}
          <div
            role="group"
            aria-label="Настройки проекции"
            class="absolute top-9 right-0 z-50 w-60 rounded-md border border-stroke-2 bg-panel-2 p-3 shadow-xl shadow-black/50"
          >
            <div class="mb-1.5 flex items-center justify-between text-sm">
              <span class="text-muted">Масштаб шрифта</span>
              <span class="font-mono text-xs text-faint tabular-nums">
                {Math.round(projSettings.fontScale * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.05"
              value={projSettings.fontScale}
              oninput={(e) => projSettings.setFontScale(parseFloat(e.currentTarget.value))}
              aria-label="Масштаб шрифта"
              class="w-full accent-[#4f83f1]"
            />
            <label class="mt-3 flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={projSettings.showReference}
                onchange={(e) => projSettings.setShowReference(e.currentTarget.checked)}
                class="accent-[#4f83f1]"
              />
              Показывать ссылку на экране
            </label>
          </div>
        {/if}
      </div>

      <span class="app-clock flex items-center gap-1.5 font-mono text-sm text-faint tabular-nums">
        <Clock4 size={12} />{clock}
      </span>
    </div>

    <button
      class="mobile-panel-toggle grid size-7 shrink-0 place-items-center rounded border border-stroke-2 text-muted"
      onclick={() => (mobilePanel = mobilePanel === 'library' ? null : 'library')}
      aria-label={mobilePanel === 'library' ? 'Закрыть библиотеку' : 'Открыть библиотеку'}
      aria-expanded={mobilePanel === 'library'}
    ><LibraryIcon size={14} /></button>
  </header>

  {#if data.status === 'loading'}
    <div class="grid place-items-center">
      <div class="flex flex-col items-center gap-1.5">
        <div class="flex items-center gap-2.5 text-base text-muted">
          <LoaderCircle size={18} class="animate-spin text-accent" />
          Загрузка переводов и песен…
        </div>
        <!-- Прогресса в байтах нет, но объём стоит назвать: первый запуск долгий -->
        <div class="text-xs text-faint">
          Первый запуск качает около 5 МБ, дальше данные берутся из кэша.
        </div>
      </div>
    </div>
  {:else if data.status === 'error'}
    <div class="grid place-items-center">
      <div class="flex flex-col items-center gap-3">
        <div class="text-base text-live">Не удалось загрузить данные.</div>
        <button
          onclick={retryLoad}
          disabled={retrying}
          class="flex h-7 items-center gap-1.5 rounded border border-stroke-2 bg-panel-2 px-2.5 text-sm
                 font-medium text-muted hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCw size={13} class={retrying ? 'animate-spin' : ''} />
          {retrying ? 'Повторяем…' : 'Повторить'}
        </button>
        <div class="text-xs text-faint">Проверьте соединение — данные подгружаются из сети.</div>
      </div>
    </div>
  {:else}
    <!-- Три зоны -->
    <div
      class="workspace-main grid min-h-0"
      style="--setlist-column: {setlistOpen ? '264px' : '44px'}"
    >
      <button
        class="workspace-scrim"
        class:is-open={mobilePanel !== null}
        onclick={() => (mobilePanel = null)}
        aria-label="Закрыть боковую панель"
      ></button>

      <div class="workspace-setlist" class:is-mobile-open={mobilePanel === 'setlist'}>
        <Setlist open={compactLayout || setlistOpen} onToggle={toggleSetlist} />
      </div>

      <!-- Центр -->
      <section class="workspace-stage flex min-h-0 min-w-0 flex-col bg-bg">
        <div class="deck-grid grid shrink-0 grid-cols-2 gap-px border-b border-stroke bg-stroke">
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

      <div class="workspace-library" class:is-mobile-open={mobilePanel === 'library'}>
        <Library />
      </div>
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
