<script lang="ts">
  import { untrack } from 'svelte'
  import {
    MonitorPlay,
    Clock4,
    LoaderCircle,
    Settings2,
    PanelRight,
    RotateCw,
    ArrowDownToLine,
    Library as LibraryIcon,
  } from '@lucide/svelte'
  import Omnibox from './lib/components/Omnibox.svelte'
  import Setlist from './lib/components/Setlist.svelte'
  import Deck from './lib/components/Deck.svelte'
  import SlideGrid from './lib/components/SlideGrid.svelte'
  import Dock from './lib/components/Dock.svelte'
  import Library from './lib/components/Library.svelte'
  import ProjectorControls from './lib/components/ProjectorControls.svelte'
  import BackgroundPanel from './lib/components/BackgroundPanel.svelte'
  import PanelResizer from './lib/components/PanelResizer.svelte'
  import { layout } from './lib/layout.svelte'
  import { fitPanels } from './lib/panel-size'
  import { show } from './lib/show.svelte'
  import { data, TRANSLATIONS } from './lib/db.svelte'
  import { setlist } from './lib/setlist.svelte'
  import { ui } from './lib/ui.svelte'
  import { commands } from './lib/commands.svelte'
  import { projSettings } from './lib/proj-settings.svelte'
  import { serviceScreen } from './lib/service-screen.svelte'
  import { mediaLibrary } from './lib/media-library.svelte'
  import {
    buildContent,
    TRANSITION_MS_MAX,
    TRANSITION_MS_MIN,
    type TransitionKind,
  } from './lib/projection'
  import { getProjectorLink } from './lib/projector-service.svelte'
  import { pushSongs, pushBible } from './lib/search-service.svelte'
  import { resolveHotkey } from './lib/hotkeys'
  import { dismissable } from './lib/dismiss'

  const TRANSITIONS: Array<[TransitionKind, string]> = [
    ['cut', 'Резко'],
    ['fade', 'Плавная смена'],
    ['blur', 'Из размытия'],
    ['lines', 'По строкам'],
    ['rise', 'Мягкий подъём'],
  ]

  let omnibox = $state<Omnibox>()
  let clock = $state('')
  let settingsOpen = $state(false)
  let mobilePanel = $state<'setlist' | 'library' | null>(null)
  let compactLayout = $state(false)
  let retrying = $state(false)
  let updateReady = $state(false)
  let updateConfirm = $state(false)

  /**
   * Обновить сейчас. Экран проектора перезагружается сам, когда новый SW
   * возьмёт управление, — иначе пульт и экран разошлись бы по версиям.
   * Cmd+Shift+R здесь не помог бы: он обходит кэш только для одной страницы
   * и не активирует ждущий Service Worker.
   */
  function applyUpdate() {
    if (!updateConfirm) {
      updateConfirm = true
      setTimeout(() => (updateConfirm = false), 4000)
      return
    }
    projector.command('reload')
    window.dispatchEvent(new CustomEvent('bp3:apply-update'))
  }
  let workspace = $state<HTMLDivElement>()

  /** Ширина свёрнутой панели — колонка иконок */
  const PANEL_RAIL = 44

  const setlistColumn = $derived(layout.setlistOpen ? layout.setlistWidth : PANEL_RAIL)
  const libraryColumn = $derived(layout.libraryOpen ? layout.libraryWidth : PANEL_RAIL)

  const projector = getProjectorLink()

  // Свои файлы оператора: подняли из IndexedDB — экран спросит их сам
  $effect(() => {
    void mediaLibrary.init()
  })
  projector.onMediaRequest = (slot) => {
    mediaLibrary
      .payload(slot)
      .then((p) => {
        if (p) projector.sendMedia(p)
      })
      .catch(() => ui.notify('Не удалось прочитать свой файл — загрузите его заново.'))
  }


  function tick() {
    const d = new Date()
    clock = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  tick()
  $effect(() => {
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  })

  // Новый SW скачался и ждёт в waiting: применится сам, когда закроют все окна
  // приложения (skipWaiting: false в vite.config.ts), или сразу — кнопкой
  // «Обновить». Посреди служения случайный клик не должен перезагрузить экран,
  // поэтому кнопка просит подтверждения вторым нажатием.
  $effect(() => {
    const onUpdateReady = () => (updateReady = true)
    window.addEventListener('bp3:update-ready', onUpdateReady)
    return () => window.removeEventListener('bp3:update-ready', onUpdateReady)
  })

  // Ширины запомнились на внешнем мониторе, а пульт открыли на ноутбуке —
  // и панели съели центр. Подрезаем сохранённое по реальной ширине окна:
  // при старте и при каждом изменении размера. untrack — чтобы правка ширины
  // не перезапускала сам эффект.
  $effect(() => {
    const el = workspace
    if (!el || compactLayout) return
    const fit = () => {
      const total = el.getBoundingClientRect().width
      if (!total) return
      untrack(() => {
        // Ужимаем только развёрнутые панели; свёрнутые занимают колонку иконок
        const open = (['library', 'setlist'] as const).filter((p) =>
          p === 'library' ? layout.libraryOpen : layout.setlistOpen,
        )
        const reserved = (2 - open.length) * PANEL_RAIL
        const fitted = fitPanels(
          open.map((p) => layout.widthOf(p)),
          { total, reserved },
        )
        open.forEach((p, i) => {
          if (fitted[i] !== layout.widthOf(p)) layout.setWidth(p, fitted[i])
        })
      })
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
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

  // Второй перевод: берём из настроек при старте и пересобираем тексты главы,
  // когда он (или основной) догрузился в фоне
  $effect(() => {
    void data.bibles
    untrack(() => {
      show.secondaryCode = projSettings.secondaryTranslation
      show.refreshSecondary()
    })
  })

  // Отдаём воркеру перевод, как только он загружен/выбран
  $effect(() => {
    pushBible(data.translation, data.bibles[data.translation] ?? null)
  })

  // Любое изменение эфира или настроек мгновенно уезжает на экран проектора
  $effect(() => {
    projector.sendState(
      buildContent({
        blackout: show.blackout,
        kind: show.kind,
        liveSlide: show.liveSlide,
        line: projSettings.lineHighlight ? show.liveLine : undefined,
        service: serviceScreen.content(),
      }),
      // $state.snapshot: вложенные ссылки — прокси, BroadcastChannel их не клонирует
      { ...projSettings.snapshot(), media: $state.snapshot(mediaLibrary.refs) },
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

  function toggleLibrary() {
    if (compactLayout) {
      mobilePanel = mobilePanel === 'library' ? null : 'library'
    } else {
      layout.toggleLibrary()
    }
  }

  function toggleSetlist() {
    if (compactLayout) {
      mobilePanel = mobilePanel === 'setlist' ? null : 'setlist'
    } else {
      layout.toggleSetlist()
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="app-shell grid h-screen grid-rows-[48px_1fr]">
  <!-- Верхняя панель -->
  <header class="app-header z-30 flex h-12 items-center gap-3 border-b border-stroke bg-panel px-3">
    <button
      class="mobile-panel-toggle grid size-7 shrink-0 place-items-center rounded border border-stroke-2 text-muted"
      onclick={() => (mobilePanel = mobilePanel === 'library' ? null : 'library')}
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
      {#if updateReady}
        <button
          onclick={applyUpdate}
          class="app-update flex h-7 shrink-0 items-center gap-1.5 rounded border px-2.5 text-sm
                 {updateConfirm
            ? 'border-accent bg-accent-dim text-ink'
            : 'border-stroke-2 bg-panel-2 text-muted hover:bg-hover hover:text-ink'}"
          aria-live="polite"
          title="Новая версия загружена. Нажмите, чтобы обновить пульт и экран проектора сейчас, — или она установится сама, когда закроете все окна приложения."
        >
          <ArrowDownToLine size={12} />
          <span>{updateConfirm ? 'Точно? Экран перезагрузится' : 'Обновить'}</span>
        </button>
      {/if}

      <ProjectorControls />

      <BackgroundPanel />

      <div class="relative" use:dismissable={{ open: settingsOpen, close: () => (settingsOpen = false) }}>
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
            class="absolute top-9 right-0 z-50 w-72 rounded-md border border-stroke-2 bg-panel-2 p-3 shadow-xl shadow-black/50"
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

            <div class="mt-3 border-t border-stroke pt-3">
              <div class="mb-1.5 text-sm text-muted">Шрифт</div>
              <div class="grid grid-cols-2 overflow-hidden rounded border border-stroke-2" role="group" aria-label="Шрифт">
                {#each [['serif', 'С засечками'], ['sans', 'Без засечек']] as const as [value, name] (value)}
                  <button
                    onclick={() => projSettings.setText({ fontFamily: value })}
                    aria-pressed={projSettings.fontFamily === value}
                    class="h-7 text-sm {value === 'sans' ? 'border-l border-stroke-2 font-sans' : 'font-serif'}
                           {projSettings.fontFamily === value ? 'bg-active text-ink' : 'bg-panel text-muted hover:bg-hover'}"
                  >
                    {name}
                  </button>
                {/each}
              </div>
            </div>

            <div class="mt-3 flex items-center justify-between gap-2 text-sm">
              <span class="text-muted">Переход</span>
              <select
                value={projSettings.transition}
                onchange={(e) =>
                  projSettings.setText({ transition: e.currentTarget.value as TransitionKind })}
                class="h-7 rounded border border-stroke-2 bg-panel px-1.5 text-sm text-ink"
                aria-label="Переход между слайдами"
              >
                {#each TRANSITIONS as [value, name] (value)}
                  <option {value}>{name}</option>
                {/each}
              </select>
            </div>
            <div class="mt-2 mb-1.5 flex items-center justify-between text-sm">
              <span class="text-muted">Длительность</span>
              <span class="font-mono text-xs text-faint tabular-nums">
                {(projSettings.transitionMs / 1000).toFixed(2)} с
              </span>
            </div>
            <input
              type="range"
              min={TRANSITION_MS_MIN}
              max={TRANSITION_MS_MAX}
              step="50"
              value={projSettings.transitionMs}
              disabled={projSettings.transition === 'cut'}
              oninput={(e) => projSettings.setText({ transitionMs: parseInt(e.currentTarget.value, 10) })}
              aria-label="Длительность перехода"
              class="w-full accent-[#4f83f1] disabled:opacity-40"
            />

            <div class="mt-3 border-t border-stroke pt-3">
              <div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
                <span class="text-muted">Второй перевод</span>
                <select
                  value={projSettings.secondaryTranslation ?? ''}
                  onchange={(e) => commands.setSecondaryTranslation(e.currentTarget.value || null)}
                  class="h-7 rounded border border-stroke-2 bg-panel px-1.5 text-sm text-ink"
                  aria-label="Второй перевод"
                >
                  <option value="">Нет</option>
                  {#each TRANSLATIONS as [code, name] (code)}
                    <option value={code} disabled={code === data.translation}>{name}</option>
                  {/each}
                </select>
              </div>
              {#if projSettings.secondaryTranslation}
                <div class="grid grid-cols-2 overflow-hidden rounded border border-stroke-2" role="group" aria-label="Раскладка двух переводов">
                  {#each [['stack', 'Один под другим'], ['side', 'Рядом']] as const as [value, name] (value)}
                    <button
                      onclick={() => projSettings.setParallel({ parallelLayout: value })}
                      aria-pressed={projSettings.parallelLayout === value}
                      class="h-7 text-sm {value === 'side' ? 'border-l border-stroke-2' : ''}
                             {projSettings.parallelLayout === value ? 'bg-active text-ink' : 'bg-panel text-muted hover:bg-hover'}"
                    >
                      {name}
                    </button>
                  {/each}
                </div>
                {#if projSettings.secondaryTranslation === data.translation}
                  <p class="mt-1.5 text-xs text-faint">Совпадает с основным переводом — показывается один.</p>
                {:else if data.translationStatus[projSettings.secondaryTranslation] !== 'ready'}
                  <p class="mt-1.5 text-xs text-faint">Перевод ещё загружается…</p>
                {/if}
              {/if}
            </div>

            <div class="mt-3 border-t border-stroke pt-3">
              <div class="mb-1.5 text-sm text-muted">Вывод</div>
              <select
                value={projSettings.layout === 'full' ? 'full' : `lt-${projSettings.chroma}`}
                onchange={(e) => {
                  const v = e.currentTarget.value
                  if (v === 'full') projSettings.setOutput({ layout: 'full' })
                  else
                    projSettings.setOutput({
                      layout: 'lower-third',
                      chroma: v === 'lt-transparent' ? 'transparent' : 'green',
                    })
                }}
                class="h-7 w-full rounded border border-stroke-2 bg-panel px-1.5 text-sm text-ink"
                aria-label="Вывод"
              >
                <option value="full">Весь экран — проектор</option>
                <option value="lt-green">Нижняя треть на зелёном — хромакей</option>
                <option value="lt-transparent">Нижняя треть на прозрачном — OBS</option>
              </select>
              {#if projSettings.layout === 'lower-third'}
                <p class="mt-1.5 text-xs text-faint">
                  Для трансляции: текст плашкой внизу, фон вырезается. Прозрачный фон — для
                  источника «Браузер» в OBS.
                </p>
              {/if}
            </div>

            <label class="mt-3 flex items-start gap-2 border-t border-stroke pt-3 text-sm text-muted">
              <input
                type="checkbox"
                checked={projSettings.lineHighlight}
                onchange={(e) => projSettings.setText({ lineHighlight: e.currentTarget.checked })}
                class="mt-0.5 accent-[#4f83f1]"
              />
              <span>
                Подсвечивать строку в песнях
                <span class="block text-xs text-faint">
                  GO сначала идёт по строкам слайда, пропетые уходят в тень
                </span>
              </span>
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
      onclick={() => (mobilePanel = mobilePanel === 'setlist' ? null : 'setlist')}
      aria-label={mobilePanel === 'setlist' ? 'Закрыть порядок служения' : 'Открыть порядок служения'}
      aria-expanded={mobilePanel === 'setlist'}
    ><PanelRight size={14} /></button>
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
    <!-- Три зоны: библиотека — источник, центр — эфир, план — справа.
         Порядок «источник → сборка → вывод» читается слева направо, а
         разделители между колонками тянутся мышью. -->
    <div
      bind:this={workspace}
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
