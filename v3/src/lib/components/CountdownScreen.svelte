<script lang="ts">
  import { countdownLeft, formatCountdown } from '../service-screen.svelte'

  interface Props {
    endsAt: number | null
    leftMs: number
    title: string
    subtitle: string
    fontScale: number
    /** Компактная строка для нижней трети */
    compact?: boolean
  }
  let { endsAt, leftMs, title, subtitle, fontScale, compact = false }: Props = $props()

  // Экран тикает сам по своим часам: пульт присылает только момент окончания
  let now = $state(Date.now())
  $effect(() => {
    if (endsAt === null) return
    now = Date.now()
    const id = setInterval(() => (now = Date.now()), 250)
    return () => clearInterval(id)
  })

  const left = $derived(countdownLeft({ endsAt, leftMs }, now))
  const finished = $derived(endsAt !== null && left === 0)
</script>

{#if compact}
  <span>
    {title}
    <span class="font-semibold tabular-nums">{finished ? 'начинаем' : formatCountdown(left)}</span>
  </span>
{:else}
  <div class="flex flex-col items-center gap-[1.2vw]">
    {#if title}
      <div
        class="tracking-[0.16em] text-amber uppercase"
        style="font-size: calc(clamp(14px, 1.6vw, 26px) * {fontScale})"
      >
        {title}
      </div>
    {/if}
    <div
      class="leading-none font-semibold tracking-tight text-white tabular-nums"
      style="font-size: calc(clamp(72px, 15vw, 240px) * {fontScale})"
    >
      {finished ? 'Начинаем' : formatCountdown(left)}
    </div>
    {#if subtitle}
      <div
        class="font-serif text-white/80"
        style="font-size: calc(clamp(18px, 2.2vw, 36px) * {fontScale})"
      >
        {subtitle}
      </div>
    {/if}
  </div>
{/if}
