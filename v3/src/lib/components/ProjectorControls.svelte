<script lang="ts">
  import { MonitorUp, MonitorX, Maximize, ChevronDown, Check } from '@lucide/svelte'
  import {
    getProjectorLink,
    openDisplayWindow,
    closeDisplayWindow,
    requestDisplayFullscreen,
    screens,
  } from '../projector-service.svelte'
  import { screenTitle, type ScreenInfo } from '../screens.svelte'

  const projector = getProjectorLink()

  let menuOpen = $state(false)
  let multiScreen = $state(false)
  let asking = $state(false)

  // projector-action — крючок для app.css: на узкой шапке эти кнопки
  // схлопываются в иконки, чтобы не выдавливать строку поиска
  const btn =
    'projector-action flex h-7 items-center gap-1.5 rounded border border-stroke-2 bg-panel-2 px-2.5 text-sm font-medium text-muted hover:bg-hover hover:text-ink'

  // Screen как EventTarget и isExtended есть не во всех тайпингах — описываем сами
  interface ScreenLike {
    isExtended?: boolean
    addEventListener?(type: string, listener: () => void): void
    removeEventListener?(type: string, listener: () => void): void
  }

  // screen.isExtended отвечает и без разрешения window-management — по нему
  // решаем, есть ли вообще из чего выбирать, не показывая лишних запросов
  $effect(() => {
    const scr = window.screen as unknown as ScreenLike
    const sync = () => {
      multiScreen = scr.isExtended === true
    }
    sync()
    scr.addEventListener?.('change', sync)
    return () => scr.removeEventListener?.('change', sync)
  })

  // Разрешение уже дано с прошлого раза — подтянем имена мониторов молча
  $effect(() => {
    void screens.refresh()
  })

  const chosen = $derived(screens.target)

  async function revealScreens() {
    asking = true
    try {
      await screens.refresh({ prompt: true })
    } finally {
      asking = false
    }
  }

  function pick(screen: ScreenInfo) {
    menuOpen = false
    openDisplayWindow(screen)
  }
</script>

{#if projector.connected}
  <span
    class="projector-status flex items-center gap-1.5 text-sm text-muted"
    title="Проектор подключён"
  >
    <span class="size-1.5 rounded-full bg-go"></span>
    <span>Проектор подключён</span>
  </span>

  {#if !projector.displayFullscreen}
    <button
      onclick={() => requestDisplayFullscreen()}
      class={btn}
      title="Развернуть окно проектора на весь монитор"
    >
      <Maximize size={13} /><span>Развернуть</span>
    </button>
  {/if}

  <button onclick={() => closeDisplayWindow()} class={btn} title="Закрыть окно проектора">
    <MonitorX size={13} /><span>Закрыть экран</span>
  </button>
{:else}
  <div class="relative flex items-center">
    <button
      onclick={() => openDisplayWindow()}
      class="projector-button flex h-7 items-center gap-1.5 rounded border border-stroke-2 bg-panel-2 px-2.5 text-sm
             font-medium text-muted hover:bg-hover hover:text-ink
             {multiScreen ? 'rounded-r-none border-r-0' : ''}"
      title={chosen ? `Открыть экран проектора · ${screenTitle(chosen)}` : 'Открыть экран проектора'}
    >
      <MonitorUp size={13} /><span>Открыть экран</span>
    </button>

    {#if multiScreen}
      <button
        onclick={() => (menuOpen = !menuOpen)}
        class="grid h-7 w-6 place-items-center rounded rounded-l-none border border-stroke-2 bg-panel-2 text-muted
               hover:bg-hover hover:text-ink {menuOpen ? 'border-accent text-ink' : ''}"
        title="Выбрать монитор"
        aria-label="Выбрать монитор"
        aria-expanded={menuOpen}
      >
        <ChevronDown size={13} />
      </button>
    {/if}

    {#if menuOpen}
      <div
        role="group"
        aria-label="Монитор проектора"
        class="absolute top-9 right-0 z-50 w-80 rounded-md border border-stroke-2 bg-panel-2 p-1.5 shadow-xl shadow-black/50"
      >
        {#if screens.list.length}
          {#each screens.list as screen (screen.id)}
            <button
              onclick={() => pick(screen)}
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted hover:bg-hover hover:text-ink"
            >
              <span class="w-3.5 shrink-0 text-accent">
                {#if chosen?.id === screen.id}<Check size={13} />{/if}
              </span>
              <span class="min-w-0 flex-1 truncate">{screenTitle(screen)}</span>
              {#if screen.isCurrent}
                <span class="shrink-0 text-2xs text-faint">здесь пульт</span>
              {/if}
            </button>
          {/each}
          <p class="px-2 pt-1.5 pb-1 text-2xs text-faint">
            Выбранный монитор запоминается — дальше экран открывается на нём сразу.
          </p>
        {:else}
          <button
            onclick={revealScreens}
            disabled={asking}
            class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted
                   hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40"
          >
            {asking ? 'Ждём ответа…' : 'Показать список мониторов'}
          </button>
          <p class="px-2 pt-1.5 pb-1 text-2xs text-faint">
            {#if screens.permission === 'denied'}
              Доступ к мониторам запрещён. Разрешите «Управление окнами» в настройках сайта.
            {:else if screens.permission === 'unsupported'}
              Браузер не умеет выбирать монитор — окно откроется рядом, перетащите его вручную.
            {:else}
              Браузер спросит разрешение на управление окнами — без него имена мониторов скрыты.
            {/if}
          </p>
        {/if}
      </div>
    {/if}
  </div>
{/if}
