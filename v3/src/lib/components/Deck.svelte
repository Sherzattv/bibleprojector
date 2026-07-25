<script lang="ts">
  interface Props {
    mode: 'preview' | 'live'
    text: string
    reference: string
    blackout?: boolean
    cleared?: boolean
  }
  let { mode, text, reference, blackout = false, cleared = false }: Props = $props()
  const isLive = mode === 'live'
</script>

<div class="min-w-0">
  <div
    class="mb-1.5 flex items-center gap-2 pl-0.5 text-[10.5px] font-bold tracking-[0.14em] uppercase
           {isLive ? 'text-live' : 'text-accent-2'}"
  >
    {isLive ? 'В эфире' : 'Превью'}
    {#if isLive}
      <span
        class="inline-flex items-center gap-1.5 rounded-full border border-live/40 bg-live-soft px-2 py-px text-[9.5px] tracking-[0.1em]"
      >
        <span class="pulse-dot size-[5px] rounded-full bg-live"></span>LIVE
      </span>
    {/if}
  </div>

  <div
    class="projection relative grid aspect-video place-items-center overflow-hidden rounded-2xl border p-[6%] text-center
           {isLive
      ? 'border-live/50 shadow-[0_0_0_1px_rgba(255,82,87,0.18),0_8px_44px_rgba(255,60,60,0.13)]'
      : 'border-accent/35'}"
  >
    {#if blackout && isLive}
      <div class="absolute inset-0 grid place-items-center bg-black text-[10px] tracking-[0.4em] text-white/18">
        BLACKOUT
      </div>
    {:else if !(cleared && isLive)}
      <div class="max-w-[94%]">
        <div
          class="font-serif text-[clamp(12px,1.35vw,19px)] leading-[1.55] font-medium text-balance
                 [text-shadow:0_2px_24px_rgba(0,0,0,0.6)]"
        >
          {#each text.split('\n') as line, i (i)}
            {line}<br />
          {/each}
        </div>
        <div class="mt-2.5 text-[clamp(9px,0.8vw,11.5px)] font-semibold tracking-[0.12em] text-amber uppercase">
          {reference}
        </div>
      </div>
    {/if}
  </div>
</div>
