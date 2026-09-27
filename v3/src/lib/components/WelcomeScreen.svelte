<script lang="ts">
  import { slideIn, slideOut, type SlideTransitionParams } from '../transitions'

  interface Props {
    name: string
    announcements: string[]
    fontScale: number
    motion: SlideTransitionParams
    /** Свой логотип общины; null — крест в круге */
    logoUrl?: string | null
    /** Компактная строка для нижней трети */
    compact?: boolean
  }
  let { name, announcements, fontScale, motion, logoUrl = null, compact = false }: Props = $props()

  /** Сколько висит одно объявление */
  const ANNOUNCEMENT_MS = 7000

  let index = $state(0)
  $effect(() => {
    if (announcements.length < 2) return
    const id = setInterval(() => (index = index + 1), ANNOUNCEMENT_MS)
    return () => clearInterval(id)
  })
  const current = $derived(
    announcements.length ? announcements[index % announcements.length] : '',
  )
</script>

{#if compact}
  <span class="grid">
    {#key current}
      <span class="[grid-area:1/1]" in:slideIn={motion} out:slideOut={motion}>
        {current || name}
      </span>
    {/key}
  </span>
{:else}
  <div class="flex w-full flex-col items-center gap-[2vw]">
    {#if logoUrl}
      <img
        src={logoUrl}
        alt=""
        class="object-contain"
        style="width: calc(clamp(72px, 12vw, 200px) * {fontScale}); max-height: 22vh"
      />
    {:else}
      <!-- Логотип по умолчанию: крест в круге цветом ссылки -->
      <svg
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        class="text-amber"
        style="width: calc(clamp(56px, 8vw, 128px) * {fontScale})"
        aria-hidden="true"
      >
        <circle cx="50" cy="50" r="46" />
        <path d="M50 22v56M34 40h32" />
      </svg>
    {/if}
    {#if name}
      <div class="font-serif text-white" style="font-size: calc(clamp(24px, 3.4vw, 56px) * {fontScale})">
        {name}
      </div>
    {/if}
    <div class="h-px w-[6vw] bg-amber/80"></div>
    <div
      class="grid w-[74vw] place-items-center text-balance text-white/90"
      style="font-size: calc(clamp(18px, 2.4vw, 40px) * {fontScale}); min-height: 2.8em"
    >
      {#key current}
        <div class="[grid-area:1/1]" in:slideIn={motion} out:slideOut={motion}>{current}</div>
      {/key}
    </div>
  </div>
{/if}
