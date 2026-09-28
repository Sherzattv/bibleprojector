<script lang="ts">
  import { Clock4 } from '@lucide/svelte'
  import { formatClock } from '../format'

  /** Минуты сменяются не чаще раза в 15 с — чаще перерисовывать незачем */
  const TICK_MS = 15_000

  let clock = $state(formatClock(new Date()))

  $effect(() => {
    const id = setInterval(() => (clock = formatClock(new Date())), TICK_MS)
    return () => clearInterval(id)
  })
</script>

<span class="app-clock flex items-center gap-1.5 font-mono text-sm text-faint tabular-nums">
  <Clock4 size={12} />{clock}
</span>
