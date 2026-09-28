<script lang="ts">
  import { Settings2 } from '@lucide/svelte'
  import { data, TRANSLATIONS } from '../db.svelte'
  import { commands } from '../commands.svelte'
  import { projSettings } from '../proj-settings.svelte'
  import { dismissable } from '../dismiss'
  import { TRANSITION_MS_MAX, TRANSITION_MS_MIN, type TransitionKind } from '../projection'

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

  let settingsOpen = $state(false)
</script>

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
