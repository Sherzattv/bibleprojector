<script lang="ts">
  import { Timer, Play, Pause, RotateCcw, Upload, X } from '@lucide/svelte'
  import { mediaLibrary } from '../../media/library.svelte'
  import { ui } from '../../ui/notices.svelte'
  import { tickingNow } from '../../ui/now.svelte'
  import Popover from '../ui/Popover.svelte'
  import SegmentedControl from '../ui/SegmentedControl.svelte'
  import { sectionLabel, selectField, textField } from '../ui/styles'
  import {
    COUNTDOWN_MINUTES,
    formatCountdown,
    serviceScreen,
    type ServiceMode,
  } from '../../projection/service-screen.svelte'

  interface Props {
    /** Классы кнопки дока — панель выглядит как соседи */
    buttonClass: string
  }
  let { buttonClass }: Props = $props()

  // Пульт показывает оставшееся время живьём, пока отсчёт идёт
  const now = tickingNow(() => serviceScreen.running)
  const left = $derived.by(() => {
    void now.value
    return serviceScreen.remaining()
  })

  const onAir = $derived(serviceScreen.mode !== 'off')
  const MODES: ReadonlyArray<{ value: ServiceMode; label: string }> = [
    { value: 'off', label: 'Выкл' },
    { value: 'countdown', label: 'Отсчёт' },
    { value: 'welcome', label: 'Ожидание' },
  ]

  function setMode(mode: ServiceMode) {
    if (mode === 'off') serviceScreen.hide()
    else serviceScreen.show(mode)
  }

  let logoInput = $state<HTMLInputElement>()
  async function onLogo(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    const error = await mediaLibrary.save('logo', file)
    if (error) ui.notify(error)
  }

  const small =
    'flex h-7 items-center gap-1.5 rounded border border-stroke-2 bg-panel px-2 text-sm text-muted hover:bg-hover hover:text-ink'
</script>

<Popover label="Заставка" placement="above" panelClass="flex w-80 flex-col gap-3 p-3">
  {#snippet trigger({ open, toggle })}
    <button
      class="{buttonClass} {onAir ? 'border-accent! text-ink!' : ''}"
      onclick={toggle}
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
  {/snippet}

  <div class="flex flex-col gap-1.5">
    <span class={sectionLabel}>На экране</span>
    <SegmentedControl
      label="Заставка на экране"
      options={MODES}
      value={serviceScreen.mode}
      onchange={setMode}
      activeClass="bg-active text-ink shadow-[inset_0_-2px_0_var(--color-accent)]"
    />
    <p class="text-xs text-faint">Заставка перекрывает слайды. GO или Esc убирают её.</p>
  </div>

  <div class="flex flex-col gap-1.5 border-t border-stroke pt-3">
    <span class={sectionLabel}>Отсчёт</span>
    <div class="flex items-center gap-1.5">
      <span class="w-14 font-mono text-lg font-semibold text-ink tabular-nums">{formatCountdown(left)}</span>
      <select
        value={String(serviceScreen.minutes)}
        onchange={(e) => serviceScreen.setMinutes(parseInt(e.currentTarget.value, 10))}
        class={selectField}
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
      class={textField}
      value={serviceScreen.title}
      onchange={(e) => serviceScreen.setTexts({ title: e.currentTarget.value })}
      placeholder="Надпись над временем"
      aria-label="Надпись над временем"
    />
    <input
      class={textField}
      value={serviceScreen.subtitle}
      onchange={(e) => serviceScreen.setTexts({ subtitle: e.currentTarget.value })}
      placeholder="Подпись под временем"
      aria-label="Подпись под временем"
    />
  </div>

  <div class="flex flex-col gap-1.5 border-t border-stroke pt-3">
    <span class={sectionLabel}>Экран ожидания</span>
    <input
      class={textField}
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
    <input bind:this={logoInput} type="file" accept="image/*" class="hidden" onchange={onLogo} />
    <div class="flex items-center gap-1.5">
      <button class="{small} min-w-0 flex-1" onclick={() => logoInput?.click()}>
        {#if mediaLibrary.previews.logo}
          <img src={mediaLibrary.previews.logo} alt="" class="size-4 object-contain" />
        {:else}
          <Upload size={12} />
        {/if}
        <span class="truncate">{mediaLibrary.names.logo || 'Загрузить логотип общины…'}</span>
      </button>
      {#if mediaLibrary.refs.logo}
        <button
          class={small}
          onclick={() => mediaLibrary.remove('logo')}
          title="Убрать логотип"
          aria-label="Убрать логотип"
        >
          <X size={12} />
        </button>
      {/if}
    </div>
  </div>
</Popover>
