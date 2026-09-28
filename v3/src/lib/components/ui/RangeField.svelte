<script lang="ts">
  /** Ползунок с подписью слева и текущим значением справа */
  interface Props {
    label: string
    /** Значение так, как его читает оператор: «135%», «×1.00», «0.40 с» */
    display: string
    value: number
    min: number
    max: number
    step: number
    disabled?: boolean
    /** Приглушать выключенный ползунок; false — если приглушён весь блок вокруг */
    dimDisabled?: boolean
    oninput: (value: number) => void
  }
  let {
    label,
    display,
    value,
    min,
    max,
    step,
    disabled = false,
    dimDisabled = true,
    oninput,
  }: Props = $props()
</script>

<label class="flex flex-col gap-1.5">
  <span class="flex items-center justify-between text-sm">
    <span class="text-muted">{label}</span>
    <span class="font-mono text-xs text-faint tabular-nums">{display}</span>
  </span>
  <input
    type="range"
    {min}
    {max}
    {step}
    {value}
    {disabled}
    aria-label={label}
    oninput={(e) => oninput(parseFloat(e.currentTarget.value))}
    class="w-full accent-accent {dimDisabled ? 'disabled:opacity-40' : ''}"
  />
</label>
