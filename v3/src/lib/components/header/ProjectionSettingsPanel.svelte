<script lang="ts">
  import { Settings2 } from '@lucide/svelte'
  import { data, TRANSLATIONS } from '../../data/db.svelte'
  import { commands } from '../../show/commands.svelte'
  import { projSettings } from '../../projection/settings.svelte'
  import {
    TRANSITION_MS_MAX,
    TRANSITION_MS_MIN,
    type ChromaKey,
    type TransitionKind,
  } from '../../projection/content'
  import Popover from '../ui/Popover.svelte'
  import RangeField from '../ui/RangeField.svelte'
  import SegmentedControl from '../ui/SegmentedControl.svelte'
  import { headerIconButton, selectField } from '../ui/styles'

  /**
   * Настройки проекции в шапке пульта: шрифт, переходы, второй перевод,
   * вывод (весь экран или нижняя треть) и подсветка строки в песнях.
   */
  const TRANSITIONS: Array<[TransitionKind, string]> = [
    ['cut', 'Резко'],
    ['fade', 'Плавная смена'],
    ['blur', 'Из размытия'],
    ['lines', 'По строкам'],
    ['rise', 'Мягкий подъём'],
  ]

  const FONTS = [
    { value: 'serif', label: 'С засечками', class: 'font-serif' },
    { value: 'sans', label: 'Без засечек', class: 'font-sans' },
  ] as const

  const PARALLEL_LAYOUTS = [
    { value: 'stack', label: 'Один под другим' },
    { value: 'side', label: 'Рядом' },
  ] as const

  /** Вывод и фон нижней трети — одним списком: так их и выбирают */
  type Output = 'full' | `lt-${ChromaKey}`
  const output = $derived<Output>(
    projSettings.layout === 'full' ? 'full' : `lt-${projSettings.chroma}`,
  )
  function setOutput(value: Output) {
    if (value === 'full') projSettings.setOutput({ layout: 'full' })
    else projSettings.setOutput({ layout: 'lower-third', chroma: value === 'lt-transparent' ? 'transparent' : 'green' })
  }

  const divider = 'mt-3 border-t border-stroke pt-3'
</script>

<Popover label="Настройки проекции" panelClass="w-72 p-3">
  {#snippet trigger({ open, toggle })}
    <button
      onclick={toggle}
      class={headerIconButton(open)}
      title="Настройки проекции"
      aria-label="Настройки проекции"
      aria-expanded={open}
    >
      <Settings2 size={13} />
    </button>
  {/snippet}

  <RangeField
    label="Масштаб шрифта"
    display="{Math.round(projSettings.fontScale * 100)}%"
    value={projSettings.fontScale}
    min={0.5}
    max={2}
    step={0.05}
    oninput={(v) => projSettings.setFontScale(v)}
  />
  <label class="mt-3 flex items-center gap-2 text-sm text-muted">
    <input
      type="checkbox"
      checked={projSettings.showReference}
      onchange={(e) => projSettings.setShowReference(e.currentTarget.checked)}
      class="accent-accent"
    />
    Показывать ссылку на экране
  </label>

  <div class={divider}>
    <div class="mb-1.5 text-sm text-muted">Шрифт</div>
    <SegmentedControl
      label="Шрифт"
      options={FONTS}
      value={projSettings.fontFamily}
      onchange={(fontFamily) => projSettings.setText({ fontFamily })}
    />
  </div>

  <div class="mt-3 mb-2 flex items-center justify-between gap-2 text-sm">
    <span class="text-muted">Переход</span>
    <select
      value={projSettings.transition}
      onchange={(e) => projSettings.setText({ transition: e.currentTarget.value as TransitionKind })}
      class={selectField}
      aria-label="Переход между слайдами"
    >
      {#each TRANSITIONS as [value, name] (value)}
        <option {value}>{name}</option>
      {/each}
    </select>
  </div>
  <RangeField
    label="Длительность"
    display="{(projSettings.transitionMs / 1000).toFixed(2)} с"
    value={projSettings.transitionMs}
    min={TRANSITION_MS_MIN}
    max={TRANSITION_MS_MAX}
    step={50}
    disabled={projSettings.transition === 'cut'}
    oninput={(v) => projSettings.setText({ transitionMs: Math.round(v) })}
  />

  <div class={divider}>
    <div class="mb-1.5 flex items-center justify-between gap-2 text-sm">
      <span class="text-muted">Второй перевод</span>
      <select
        value={projSettings.secondaryTranslation ?? ''}
        onchange={(e) => commands.setSecondaryTranslation(e.currentTarget.value || null)}
        class={selectField}
        aria-label="Второй перевод"
      >
        <option value="">Нет</option>
        {#each TRANSLATIONS as [code, name] (code)}
          <option value={code} disabled={code === data.translation}>{name}</option>
        {/each}
      </select>
    </div>
    {#if projSettings.secondaryTranslation}
      <SegmentedControl
        label="Раскладка двух переводов"
        options={PARALLEL_LAYOUTS}
        value={projSettings.parallelLayout}
        onchange={(parallelLayout) => projSettings.setParallel({ parallelLayout })}
      />
      {#if projSettings.secondaryTranslation === data.translation}
        <p class="mt-1.5 text-xs text-faint">Совпадает с основным переводом — показывается один.</p>
      {:else if data.translationStatus[projSettings.secondaryTranslation] !== 'ready'}
        <p class="mt-1.5 text-xs text-faint">Перевод ещё загружается…</p>
      {/if}
    {/if}
  </div>

  <div class={divider}>
    <div class="mb-1.5 text-sm text-muted">Вывод</div>
    <select
      value={output}
      onchange={(e) => setOutput(e.currentTarget.value as Output)}
      class="{selectField} w-full"
      aria-label="Вывод"
    >
      <option value="full">Весь экран — проектор</option>
      <option value="lt-green">Нижняя треть на зелёном — хромакей</option>
      <option value="lt-transparent">Нижняя треть на прозрачном — OBS</option>
    </select>
    {#if projSettings.layout === 'lower-third'}
      <p class="mt-1.5 text-xs text-faint">
        Для трансляции: текст плашкой внизу, фон вырезается. Прозрачный фон — для источника
        «Браузер» в OBS.
      </p>
    {/if}
  </div>

  <label class="{divider} flex items-start gap-2 text-sm text-muted">
    <input
      type="checkbox"
      checked={projSettings.lineHighlight}
      onchange={(e) => projSettings.setText({ lineHighlight: e.currentTarget.checked })}
      class="mt-0.5 accent-accent"
    />
    <span>
      Подсвечивать строку в песнях
      <span class="block text-xs text-faint">
        GO сначала идёт по строкам слайда, пропетые уходят в тень
      </span>
    </span>
  </label>
</Popover>
