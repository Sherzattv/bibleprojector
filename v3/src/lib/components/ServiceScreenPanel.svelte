<script lang="ts">
  import { Timer, Play, Pause, RotateCcw } from '@lucide/svelte'
  import {
    COUNTDOWN_MINUTES,
    formatCountdown,
    serviceScreen,
    type ServiceMode,
  } from '../service-screen.svelte'

  interface Props {
    /** Классы кнопки дока — панель выглядит как соседи */
    buttonClass: string
  }
  let { buttonClass }: Props = $props()

  let open = $state(false)

  // Пульт показывает оставшееся время живьём, пока отсчёт идёт
  let now = $state(Date.now())
  $effect(() => {
    if (!serviceScreen.running) return
    now = Date.now()
    const id = setInterval(() => (now = Date.now()), 250)
    return () => clearInterval(id)
  })
  const left = $derived.by(() => {
    void now
    return serviceScreen.remaining()
  })

  const onAir = $derived(serviceScreen.mode !== 'off')
  const modes: Array<[ServiceMode, string]> = [
    ['off', 'Выкл'],
    ['countdown', 'Отсчёт'],
    ['welcome', 'Ожидание'],
  ]

  function setMode(mode: ServiceMode) {
    if (mode === 'off') serviceScreen.hide()
    else serviceScreen.show(mode)
  }

  const input =
    'h-7 w-full rounded border border-stroke-2 bg-panel px-2 text-sm text-ink placeholder:text-faint'
  const label = 'text-2xs font-semibold tracking-wide text-faint uppercase'
  const small =
    'flex h-7 items-center gap-1.5 rounded border border-stroke-2 bg-panel px-2 text-sm text-muted hover:bg-hover hover:text-ink'
</script>

<div class="relative">
  <button
    class="{buttonClass} {onAir ? 'border-accent! text-ink!' : ''}"
    onclick={() => (open = !open)}
    aria-expanded={open}
    title="Отсчёт до начала и экран ожидания"
  >
    <Timer size={13} />
    {#if serviceScreen.mode === 'countdown'}
      <span class="tabular-nums">{formatCountdown(left)}</span>
    {:else}
      Заставка
    {/if}
  </button>

  {#if open}
    <div
      role="group"
      aria-label="Заставка"
      class="absolute bottom-9 left-0 z-50 flex w-80 flex-col gap-3 rounded-md border border-stroke-2 bg-panel-2 p-3 shadow-xl shadow-black/50"
    >
      <div class="flex flex-col gap-1.5">
        <span class={label}>На экране</span>
        <div class="grid grid-cols-3 overflow-hidden rounded border border-stroke-2" role="group" aria-label="Заставка на экране">
          {#each modes as [mode, name], i (mode)}
            <button
              onclick={() => setMode(mode)}
              aria-pressed={serviceScreen.mode === mode}
              class="h-7 text-sm {i ? 'border-l border-stroke-2' : ''}
                     {serviceScreen.mode === mode ? 'bg-active text-ink shadow-[inset_0_-2px_0_var(--color-accent)]' : 'bg-panel text-muted hover:bg-hover'}"
            >
              {name}
            </button>
          {/each}
        </div>
        <p class="text-xs text-faint">Заставка перекрывает слайды. GO или Esc убирают её.</p>
      </div>

      <div class="flex flex-col gap-1.5 border-t border-stroke pt-3">
        <span class={label}>Отсчёт</span>
        <div class="flex items-center gap-1.5">
          <span class="w-14 font-mono text-lg font-semibold text-ink tabular-nums">{formatCountdown(left)}</span>
          <select
            value={String(serviceScreen.minutes)}
            onchange={(e) => serviceScreen.setMinutes(parseInt(e.currentTarget.value, 10))}
            class="h-7 rounded border border-stroke-2 bg-panel px-1.5 text-sm text-ink"
            aria-label="Длительность отсчёта"
          >
            {#each COUNTDOWN_MINUTES as m (m)}
              <option value={String(m)}>{m} мин</option>
            {/each}
          </select>
          {#if serviceScreen.running}
            <button class={small} onclick={() => serviceScreen.pause()}><Pause size={12} />Пауза</button>
          {:else}
            <button
              class={small}
              onclick={() => {
                serviceScreen.start()
                serviceScreen.show('countdown')
              }}
            >
              <Play size={12} />Старт
            </button>
          {/if}
          <button class={small} onclick={() => serviceScreen.reset()} title="Сбросить" aria-label="Сбросить отсчёт">
            <RotateCcw size={12} />
          </button>
        </div>
        <input
          class={input}
          value={serviceScreen.title}
          onchange={(e) => serviceScreen.setTexts({ title: e.currentTarget.value })}
          placeholder="Надпись над временем"
          aria-label="Надпись над временем"
        />
        <input
          class={input}
          value={serviceScreen.subtitle}
          onchange={(e) => serviceScreen.setTexts({ subtitle: e.currentTarget.value })}
          placeholder="Подпись под временем"
          aria-label="Подпись под временем"
        />
      </div>

      <div class="flex flex-col gap-1.5 border-t border-stroke pt-3">
        <span class={label}>Экран ожидания</span>
        <input
          class={input}
          value={serviceScreen.churchName}
          onchange={(e) => serviceScreen.setTexts({ churchName: e.currentTarget.value })}
          placeholder="Название общины"
          aria-label="Название общины"
        />
        <textarea
          class="min-h-20 w-full resize-y rounded border border-stroke-2 bg-panel px-2 py-1.5 text-sm text-ink placeholder:text-faint"
          value={serviceScreen.announcements.join('\n')}
          onchange={(e) => serviceScreen.setAnnouncements(e.currentTarget.value)}
          placeholder="Объявления, по одному на строку"
          aria-label="Объявления, по одному на строку"
        ></textarea>
        <p class="text-xs text-faint">Объявления сменяются каждые 7 секунд.</p>
      </div>
    </div>
  {/if}
</div>
