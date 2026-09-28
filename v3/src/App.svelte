<script lang="ts">
  import { MonitorPlay, PanelRight, Library as LibraryIcon } from '@lucide/svelte'
  import Omnibox from './lib/components/header/Omnibox.svelte'
  import ProjectorControls from './lib/components/header/ProjectorControls.svelte'
  import BackgroundPanel from './lib/components/header/BackgroundPanel.svelte'
  import ProjectionSettingsPanel from './lib/components/header/ProjectionSettingsPanel.svelte'
  import UpdateButton from './lib/components/header/UpdateButton.svelte'
  import HeaderClock from './lib/components/header/HeaderClock.svelte'
  import Library from './lib/components/workspace/Library.svelte'
  import Setlist from './lib/components/workspace/Setlist.svelte'
  import Deck from './lib/components/workspace/Deck.svelte'
  import SlideGrid from './lib/components/workspace/SlideGrid.svelte'
  import Dock from './lib/components/workspace/Dock.svelte'
  import PanelResizer from './lib/components/workspace/PanelResizer.svelte'
  import StartupScreen from './lib/components/workspace/StartupScreen.svelte'
  import NoticeToast from './lib/components/workspace/NoticeToast.svelte'
  import { data } from './lib/data/db.svelte'
  import { startData } from './lib/data/startup.svelte'
  import { getProjectorLink } from './lib/projector/service.svelte'
  import { syncProjector } from './lib/projector/sync.svelte'
  import { show } from './lib/show/show.svelte'
  import { commands } from './lib/show/commands.svelte'
  import { layout } from './lib/ui/layout.svelte'
  import { PANEL_RAIL } from './lib/ui/panel-size'
  import { fitPanelsToWindow } from './lib/ui/fit-panels'
  import { resolveHotkey } from './lib/ui/hotkeys'

  /**
   * Пульт оператора: шапка, библиотека, превью и эфир, порядок служения.
   * Данные, связь с экраном и логика эфира живут в lib — здесь раскладка.
   */
  startData()
  syncProjector(getProjectorLink())

  let omnibox = $state<Omnibox>()
  let workspace = $state<HTMLDivElement>()

  const setlistColumn = $derived(layout.setlistOpen ? layout.setlistWidth : PANEL_RAIL)
  const libraryColumn = $derived(layout.libraryOpen ? layout.libraryWidth : PANEL_RAIL)

  // Узкое окно — неподдерживаемый fallback: боковые панели выезжают поверх центра
  let mobilePanel = $state<'setlist' | 'library' | null>(null)
  let compactLayout = $state(false)

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

  function toggleMobilePanel(panel: 'setlist' | 'library') {
    mobilePanel = mobilePanel === panel ? null : panel
  }

  function toggleLibrary() {
    if (compactLayout) toggleMobilePanel('library')
    else layout.toggleLibrary()
  }

  function toggleSetlist() {
    if (compactLayout) toggleMobilePanel('setlist')
    else layout.toggleSetlist()
  }

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
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-shell grid h-screen grid-rows-[48px_1fr]">
  <!-- Верхняя панель -->
  <header class="app-header z-30 flex h-12 items-center gap-3 border-b border-stroke bg-panel px-3">
    <button
      class="mobile-panel-toggle grid size-7 shrink-0 place-items-center rounded border border-stroke-2 text-muted"
      onclick={() => toggleMobilePanel('library')}
      aria-label={mobilePanel === 'library' ? 'Закрыть библиотеку' : 'Открыть библиотеку'}
      aria-expanded={mobilePanel === 'library'}
    ><LibraryIcon size={14} /></button>

    <div class="app-brand flex shrink-0 items-center gap-2 text-base font-semibold">
      <MonitorPlay size={16} class="text-accent" />
      <span>Bible Projector</span>
      <!-- Версия на виду: новый Service Worker ждёт закрытия всех окон, и без
           этой строки «у меня старая оболочка» не отличить от «не задеплоили».
           В интерфейсе — понятный номер, коммит сборки прячем в подсказку -->
      <span
        class="app-version text-2xs font-normal text-faint tabular-nums"
        title="Версия {__APP_VERSION__} · сборка {__BUILD_COMMIT__}"
      >
        v{__APP_VERSION__}
      </span>
    </div>

    <Omnibox bind:this={omnibox} />

    <div class="app-actions ml-auto flex shrink-0 items-center gap-2.5">
      <UpdateButton />

      <ProjectorControls />

      <BackgroundPanel />

      <ProjectionSettingsPanel />

      <HeaderClock />
    </div>

    <button
      class="mobile-panel-toggle grid size-7 shrink-0 place-items-center rounded border border-stroke-2 text-muted"
      onclick={() => toggleMobilePanel('setlist')}
      aria-label={mobilePanel === 'setlist' ? 'Закрыть порядок служения' : 'Открыть порядок служения'}
      aria-expanded={mobilePanel === 'setlist'}
    ><PanelRight size={14} /></button>
  </header>

  {#if data.status !== 'ready'}
    <StartupScreen />
  {:else}
    <!-- Три зоны: библиотека — источник, центр — эфир, план — справа.
         Порядок «источник → сборка → вывод» читается слева направо, а
         разделители между колонками тянутся мышью. -->
    <div
      bind:this={workspace}
      use:fitPanelsToWindow={!compactLayout}
      class="workspace-main grid min-h-0"
      style="--library-column: {libraryColumn}px; --setlist-column: {setlistColumn}px"
    >
      <button
        class="workspace-scrim"
        class:is-open={mobilePanel !== null}
        onclick={() => (mobilePanel = null)}
        aria-label="Закрыть боковую панель"
      ></button>

      <div class="workspace-library" class:is-mobile-open={mobilePanel === 'library'}>
        <Library open={compactLayout || layout.libraryOpen} onToggle={toggleLibrary} />
      </div>

      <!-- Свёрнутую библиотеку тянуть не за что -->
      {#if layout.libraryOpen}
        <PanelResizer
          panel="library"
          edge="left"
          label="Ширина библиотеки"
          {workspace}
          taken={setlistColumn}
        />
      {/if}

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

      <!-- Свёрнутый план тянуть не за что -->
      {#if layout.setlistOpen}
        <PanelResizer
          panel="setlist"
          edge="right"
          label="Ширина порядка служения"
          {workspace}
          taken={libraryColumn}
        />
      {/if}

      <div class="workspace-setlist" class:is-mobile-open={mobilePanel === 'setlist'}>
        <Setlist open={compactLayout || layout.setlistOpen} onToggle={toggleSetlist} />
      </div>
    </div>
  {/if}

  <NoticeToast />
</div>
