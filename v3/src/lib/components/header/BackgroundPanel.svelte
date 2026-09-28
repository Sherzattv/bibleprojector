<script lang="ts">
  import { Palette, RefreshCw, Star, Upload, X } from '@lucide/svelte'
  import {
    BACKGROUND_GROUPS,
    BACKGROUNDS,
    PALETTES,
    findPalette,
    findPreset,
    type BackgroundPreset,
  } from '../../backgrounds/catalog'
  import { contrastLevel } from '../../backgrounds/contrast'
  import { DIM_MAX, SPEED_MAX, isAnimated } from '../../backgrounds/settings'
  import { projSettings } from '../../projection/settings.svelte'
  import { getProjectorLink } from '../../projector/service.svelte'
  import { mediaLibrary } from '../../media/library.svelte'
  import { ui } from '../../ui/notices.svelte'
  import Popover from '../ui/Popover.svelte'
  import PaletteSwatch from '../ui/PaletteSwatch.svelte'
  import RangeField from '../ui/RangeField.svelte'
  import { headerIconButton, sectionLabel, selectField } from '../ui/styles'

  const projector = getProjectorLink()

  const bg = $derived(projSettings.background)
  const animated = $derived(isAnimated(bg))
  const contrast = $derived(projector.displayContrast)

  const contrastText = $derived.by(() => {
    if (!animated) return 'Чёрный фон — текст читается идеально'
    if (!projector.connected) return 'Откройте экран — контраст измерится на нём'
    if (contrast === null) return 'Измеряем контраст…'
    const level = contrastLevel(contrast)
    const verdict =
      level === 'good' ? 'отлично' : level === 'ok' ? 'нормально' : 'слабо — добавьте затемнение'
    return `Контраст текста ${contrast.toFixed(1)}:1 · ${verdict}`
  })
  const contrastWarn = $derived(animated && contrast !== null && contrastLevel(contrast) !== 'good')

  let fileInput = $state<HTMLInputElement>()

  /** Своего файла ещё нет — выбрать его; есть — поставить фоном */
  function pickOwn() {
    if (!mediaLibrary.refs.background) fileInput?.click()
    else projSettings.selectBackground('media')
  }

  async function onFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0]
    e.currentTarget.value = ''
    if (!file) return
    const error = await mediaLibrary.save('background', file)
    if (error) ui.notify(error)
    else projSettings.selectBackground('media')
  }

  async function removeFile() {
    await mediaLibrary.remove('background')
    if (bg.preset === 'media') projSettings.selectBackground('black')
  }

  const row = 'flex items-center justify-between text-sm'
</script>

<!-- Фон в сетке: выбрать — сам фон, звёздочка справа — в избранное -->
{#snippet presetCell(preset: BackgroundPreset)}
  {@const fav = projSettings.favorites.includes(preset.id)}
  <div class="group/cell relative">
    <button
      onclick={() => projSettings.selectBackground(preset.id)}
      aria-pressed={bg.preset === preset.id}
      title={preset.description}
      class="flex h-7 w-full items-center gap-2 rounded border pr-7 pl-2 text-left text-sm
             {bg.preset === preset.id
        ? 'border-accent bg-accent-dim text-ink'
        : 'border-stroke-2 bg-panel text-muted hover:bg-hover hover:text-ink'}"
    >
      <PaletteSwatch preset={preset.id} palette={preset.palette} class="h-3 w-6 rounded" />
      <span class="truncate">{preset.name}</span>
    </button>
    <button
      onclick={() => projSettings.toggleFavorite(preset.id)}
      aria-pressed={fav}
      aria-label={fav ? `Убрать «${preset.name}» из избранного` : `Добавить «${preset.name}» в избранное`}
      title={fav ? 'Убрать из избранного' : 'В избранное'}
      class="absolute top-0.5 right-0.5 grid size-6 place-items-center rounded hover:bg-hover
             {fav
        ? 'text-amber'
        : 'text-faint opacity-0 group-hover/cell:opacity-100 focus-visible:opacity-100'}"
    >
      <Star size={12} fill={fav ? 'currentColor' : 'none'} />
    </button>
  </div>
{/snippet}

<Popover label="Фон экрана" panelClass="flex max-h-[calc(100vh-64px)] w-96 flex-col overflow-y-auto">
  {#snippet trigger({ open, toggle })}
    <button
      onclick={toggle}
      class={headerIconButton(open)}
      title="Фон экрана"
      aria-label="Фон экрана"
      aria-expanded={open}
    >
      <Palette size={13} />
    </button>
  {/snippet}

  <div
    class="border-b border-stroke px-3 py-2 text-sm {contrastWarn ? 'text-amber' : 'text-muted'}"
    role="status"
    aria-live="polite"
  >
    {contrastText}
  </div>

  <div class="flex flex-col gap-3 p-3">
    {#if projSettings.favorites.length}
      <div class="flex flex-col gap-1.5">
        <span class={sectionLabel}>★ Избранное</span>
        <div class="grid grid-cols-2 gap-1.5">
          {#each projSettings.favorites as id (id)}
            {@render presetCell(findPreset(id))}
          {/each}
        </div>
      </div>
    {/if}
    {#each BACKGROUND_GROUPS as group (group.id)}
      {@const presets = BACKGROUNDS.filter((b) => b.group === group.id && b.kind !== 'media')}
      <div class="flex flex-col gap-1.5">
        <span class={sectionLabel}>{group.name}</span>
        {#if presets.length}
          <div class="grid grid-cols-2 gap-1.5">
            {#each presets as preset (preset.id)}
              {@render presetCell(preset)}
            {/each}
          </div>
        {/if}

        {#if group.id === 'own'}
          <!-- Одна кнопка на свой файл: нет файла — выбрать, есть — поставить фоном -->
          <input
            bind:this={fileInput}
            type="file"
            accept="image/*,video/mp4,video/webm"
            class="hidden"
            onchange={onFile}
          />
          <div class="flex items-center gap-1.5">
            <button
              onclick={pickOwn}
              aria-pressed={bg.preset === 'media'}
              class="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded border px-2 text-sm
                     {bg.preset === 'media'
                ? 'border-accent bg-accent-dim text-ink'
                : 'border-stroke-2 bg-panel text-muted hover:bg-hover hover:text-ink'}"
            >
              <Upload size={12} />
              <span class="truncate">
                {mediaLibrary.names.background || 'Загрузить фото или видео…'}
              </span>
            </button>
            {#if mediaLibrary.refs.background}
              <button
                onclick={() => fileInput?.click()}
                class="grid size-7 place-items-center rounded border border-stroke-2 bg-panel text-muted hover:bg-hover hover:text-ink"
                title="Заменить файл"
                aria-label="Заменить свой файл"
              >
                <RefreshCw size={12} />
              </button>
              <button
                onclick={removeFile}
                class="grid size-7 place-items-center rounded border border-stroke-2 bg-panel text-muted hover:bg-hover hover:text-ink"
                title="Убрать свой файл"
                aria-label="Убрать свой файл"
              >
                <X size={12} />
              </button>
            {/if}
          </div>
          <p class="text-xs text-faint">
            Картинка до 10 МБ или видео MP4/WebM до 40 МБ, лучше без звука и зацикленное.
          </p>
        {/if}
      </div>
    {/each}
  </div>

  <div class="flex flex-col gap-3 border-t border-stroke p-3" class:opacity-40={!animated}>
    <div class="flex flex-col gap-1.5">
      <span class={sectionLabel}>Палитра · {findPalette(bg.palette).name}</span>
      <div class="flex flex-wrap gap-1.5">
        {#each PALETTES as p (p.id)}
          <button
            onclick={() => projSettings.setBackground({ palette: p.id })}
            disabled={!animated}
            aria-pressed={bg.palette === p.id}
            aria-label={p.name}
            title={p.name}
            class="flex h-6 w-9 overflow-hidden rounded border
                   {bg.palette === p.id ? 'border-accent ring-1 ring-accent' : 'border-stroke-2'}"
          >
            {#each p.colors.slice(1) as c (c)}
              <span class="flex-1" style="background: {c}"></span>
            {/each}
          </button>
        {/each}
      </div>
    </div>

    <RangeField
      label="Скорость"
      display={bg.speed === 0 ? 'стоп' : `×${bg.speed.toFixed(2)}`}
      value={bg.speed}
      min={0}
      max={SPEED_MAX}
      step={0.05}
      disabled={!animated}
      dimDisabled={false}
      oninput={(speed) => projSettings.setBackground({ speed })}
    />
    <RangeField
      label="Затемнение под текстом"
      display="{Math.round(bg.dim * 100)}%"
      value={bg.dim}
      min={0}
      max={DIM_MAX}
      step={0.05}
      disabled={!animated}
      dimDisabled={false}
      oninput={(dim) => projSettings.setBackground({ dim })}
    />
    <RangeField
      label="Виньетка"
      display="{Math.round(bg.vignette * 100)}%"
      value={bg.vignette}
      min={0}
      max={1}
      step={0.05}
      disabled={!animated}
      dimDisabled={false}
      oninput={(vignette) => projSettings.setBackground({ vignette })}
    />

    <label class="flex items-center gap-2 text-sm text-muted">
      <input
        type="checkbox"
        checked={bg.grain}
        disabled={!animated}
        onchange={(e) => projSettings.setBackground({ grain: e.currentTarget.checked })}
        class="accent-accent"
      />
      Зерно — убирает полосы градиента на проекторе
    </label>
  </div>

  <div class="flex flex-col gap-2 border-t border-stroke p-3">
    <label class="flex items-center gap-2 text-sm text-muted">
      <input
        type="checkbox"
        checked={projSettings.textShadow}
        onchange={(e) => projSettings.setTextShadow(e.currentTarget.checked)}
        class="accent-accent"
      />
      Тень под текстом
    </label>
    <div class={row}>
      <span class="text-muted">Разрешение фона</span>
      <select
        value={String(bg.quality)}
        onchange={(e) =>
          projSettings.setBackground({ quality: parseFloat(e.currentTarget.value) as 0.5 | 0.75 | 1 })}
        class={selectField}
        aria-label="Разрешение фона"
      >
        <option value="0.5">50% — для слабых ПК</option>
        <option value="0.75">75%</option>
        <option value="1">100%</option>
      </select>
    </div>
    <div class={row}>
      <span class="text-muted">Частота кадров</span>
      <select
        value={String(bg.fps)}
        onchange={(e) => projSettings.setBackground({ fps: parseInt(e.currentTarget.value, 10) as 30 | 60 })}
        class={selectField}
        aria-label="Частота кадров фона"
      >
        <option value="30">30 к/с</option>
        <option value="60">60 к/с</option>
      </select>
    </div>
    <p class="text-xs text-faint">
      Больше — чуть чётче и плавнее, но сильнее греет видеокарту. На мягких фонах разница почти
      не видна; если ноутбук тормозит или шумит, ставьте 50% и 30 к/с.
    </p>
  </div>
</Popover>
