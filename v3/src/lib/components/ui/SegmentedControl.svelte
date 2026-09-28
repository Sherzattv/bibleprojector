<script lang="ts" generics="T extends string">
  /**
   * Выбор одного из нескольких вариантов кнопками в ряд: шрифт, раскладка
   * двух переводов, режим заставки. Нажатый вариант — aria-pressed.
   */
  interface Option {
    value: T
    label: string
    /** Дополнительные классы варианта — например, его собственный шрифт */
    class?: string
  }
  interface Props {
    label: string
    options: readonly Option[]
    value: T
    onchange: (value: T) => void
    /** Вид выбранного варианта */
    activeClass?: string
  }
  let { label, options, value, onchange, activeClass = 'bg-active text-ink' }: Props = $props()

  // Tailwind видит только целые имена классов — поэтому таблица, а не шаблон
  const COLUMNS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }
</script>

<div
  class="grid {COLUMNS[options.length] ?? ''} overflow-hidden rounded border border-stroke-2"
  role="group"
  aria-label={label}
>
  {#each options as option, i (option.value)}
    <button
      onclick={() => onchange(option.value)}
      aria-pressed={value === option.value}
      class="h-7 text-sm {i ? 'border-l border-stroke-2' : ''} {option.class ?? ''}
             {value === option.value ? activeClass : 'bg-panel text-muted hover:bg-hover'}"
    >
      {option.label}
    </button>
  {/each}
</div>
