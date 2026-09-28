<script lang="ts">
  import { Palette, RefreshCw, Upload, X } from '@lucide/svelte'
  import { BACKGROUND_GROUPS, BACKGROUNDS, PALETTES, findPalette } from '../backgrounds/catalog'
  import { contrastLevel } from '../backgrounds/contrast'
  import { DIM_MAX, SPEED_MAX, isAnimated } from '../backgrounds/settings'
  import { projSettings } from '../proj-settings.svelte'
  import { getProjectorLink } from '../projector-service.svelte'
  import { dismissable } from '../dismiss'
  import { mediaLibrary } from '../media-library.svelte'
  import { ui } from '../ui.svelte'

  const projector = getProjectorLink()

  let open = $state(false)

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


  const label = 'text-2xs font-semibold tracking-wide text-faint uppercase'
  const row = 'flex items-center justify-between text-sm'
</script>

<div class="relative" use:dismissable={{ open, close: () => (open = false) }}>
  <button
    onclick={() => (open = !open)}
    class="grid size-7 place-items-center rounded border border-stroke-2 bg-panel-2 text-muted hover:bg-hover hover:text-ink
           {open ? 'border-accent text-ink' : ''}"
    title="Фон экрана"
    aria-label="Фон экрана"
    aria-expanded={open}
  >
    <Palette size={13} />
  </button>

  {#if open}
    <div
      role="group"
      aria-label="Фон экрана"
      class="absolute top-9 right-0 z-50 flex max-h-[calc(100vh-64px)] w-96 flex-col overflow-y-auto rounded-md border
             border-stroke-2 bg-panel-2 shadow-xl shadow-black/50"
    >
      <div
        class="border-b border-stroke px-3 py-2 text-sm {contrastWarn ? 'text-amber' : 'text-muted'}"
        role="status"
        aria-live="polite"
      >
        {contrastText}
      </div>

      <div class="flex flex-col gap-3 p-3">
        {#each BACKGROUND_GROUPS as group (group.id)}
          {@const presets = BACKGROUNDS.filter((b) => b.group === group.id && b.kind !== 'media')}
          <div class="flex flex-col gap-1.5">
            <span class={label}>{group.name}</span>
            {#if presets.length}
              <div class="grid grid-cols-2 gap-1.5">
                {#each presets as preset (preset.id)}
                  {@const colors = findPalette(preset.palette).colors}
                  <button
                    onclick={() => projSettings.selectBackground(preset.id)}
                    aria-pressed={bg.preset === preset.id}
                    title={preset.description}
                    class="flex h-7 items-center gap-2 rounded border px-2 text-left text-sm
                           {bg.preset === preset.id
                      ? 'border-accent bg-accent-dim text-ink'
                      : 'border-stroke-2 bg-panel text-muted hover:bg-hover hover:text-ink'}"
                  >
                    <span class="flex h-3 w-6 shrink-0 overflow-hidden rounded border border-stroke-2">
                      {#if preset.kind === 'none'}
                        <span class="flex-1 bg-black"></span>
                      {:else}
                        {#each colors.slice(1) as c (c)}
                          <span class="flex-1" style="background: {c}"></span>
                        {/each}
                      {/if}
                    </span>
                    <span class="truncate">{preset.name}</span>
                  </button>
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
          <span class={label}>Палитра · {findPalette(bg.palette).name}</span>
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

        <label class="flex flex-col gap-1">
          <span class={row}>
            <span class="text-muted">Скорость</span>
            <span class="font-mono text-xs text-faint tabular-nums">
              {bg.speed === 0 ? 'стоп' : `×${bg.speed.toFixed(2)}`}
            </span>
          </span>
          <input
            type="range"
            min="0"
            max={SPEED_MAX}
            step="0.05"
            value={bg.speed}
            disabled={!animated}
            oninput={(e) => projSettings.setBackground({ speed: parseFloat(e.currentTarget.value) })}
            class="w-full accent-[#4f83f1]"
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class={row}>
            <span class="text-muted">Затемнение под текстом</span>
            <span class="font-mono text-xs text-faint tabular-nums">{Math.round(bg.dim * 100)}%</span>
          </span>
          <input
            type="range"
            min="0"
            max={DIM_MAX}
            step="0.05"
            value={bg.dim}
            disabled={!animated}
            oninput={(e) => projSettings.setBackground({ dim: parseFloat(e.currentTarget.value) })}
            class="w-full accent-[#4f83f1]"
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class={row}>
            <span class="text-muted">Виньетка</span>
            <span class="font-mono text-xs text-faint tabular-nums">{Math.round(bg.vignette * 100)}%</span>
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={bg.vignette}
            disabled={!animated}
            oninput={(e) => projSettings.setBackground({ vignette: parseFloat(e.currentTarget.value) })}
            class="w-full accent-[#4f83f1]"
          />
        </label>

        <label class="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={bg.grain}
            disabled={!animated}
            onchange={(e) => projSettings.setBackground({ grain: e.currentTarget.checked })}
            class="accent-[#4f83f1]"
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
            class="accent-[#4f83f1]"
          />
          Тень под текстом
        </label>
        <div class={row}>
          <span class="text-muted">Разрешение фона</span>
          <select
            value={String(bg.quality)}
            onchange={(e) =>
              projSettings.setBackground({ quality: parseFloat(e.currentTarget.value) as 0.5 | 0.75 | 1 })}
            class="h-7 rounded border border-stroke-2 bg-panel px-1.5 text-sm text-ink"
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
            class="h-7 rounded border border-stroke-2 bg-panel px-1.5 text-sm text-ink"
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
    </div>
  {/if}
</div>
