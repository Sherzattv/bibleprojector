<script lang="ts" generics="T extends string">
  /**
   * Компактный переключатель в строке статуса библиотеки: язык песен,
   * перевод Библии. Нажатый вариант — aria-pressed.
   */
  interface Option {
    value: T
    label: string
    /** Полное имя для подсказки */
    title: string
    /** Ещё не загружен — выбрать нельзя */
    disabled?: boolean
  }
  interface Props {
    label: string
    options: readonly Option[]
    value: T
    onchange: (value: T) => void
  }
  let { label, options, value, onchange }: Props = $props()
</script>

<div class="flex shrink-0 items-center gap-0.5" role="group" aria-label={label}>
  {#each options as option (option.value)}
    <button
      onclick={() => onchange(option.value)}
      aria-pressed={value === option.value}
      disabled={option.disabled}
      title={option.title}
      class="h-6 rounded px-1.5 text-2xs font-semibold tracking-wide uppercase
             disabled:pointer-events-none disabled:opacity-40
             {value === option.value ? 'bg-active text-accent' : 'text-faint hover:bg-hover hover:text-muted'}"
    >
      {option.label}
    </button>
  {/each}
</div>
