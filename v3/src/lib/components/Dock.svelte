<script lang="ts">
  import { show } from '../show.svelte'

  const btn =
    'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-medium text-muted transition hover:bg-surface-2 hover:text-ink'
  const kbd = 'rounded-[5px] border border-stroke px-1 py-px font-mono text-[9.5px] text-faint'
</script>

<div class="flex shrink-0 justify-center pt-1">
  <div
    class="flex items-center gap-1.5 rounded-full border border-stroke-strong bg-[rgba(18,20,26,0.75)] px-2 py-1.5
           shadow-2xl shadow-black/50 backdrop-blur-2xl"
  >
    <button class={btn} onclick={() => show.prev()}>‹ Назад <kbd class={kbd}>←</kbd></button>

    <button
      onclick={() => show.go()}
      class="flex items-center gap-2 rounded-full bg-gradient-to-br from-go to-go-2 px-6 py-2 text-[13.5px]
             font-extrabold text-[#04140b] shadow-[0_6px_22px_rgba(30,190,100,0.35)] transition hover:brightness-108"
    >
      GO <kbd class="rounded-[5px] border border-[rgba(4,20,11,0.25)] px-1 py-px font-mono text-[9.5px] text-[rgba(4,20,11,0.6)]">Space</kbd>
    </button>

    <button class={btn} onclick={() => show.next()}>Вперёд › <kbd class={kbd}>→</kbd></button>

    <span class="mx-0.5 h-5 w-px bg-stroke-strong"></span>

    <button
      class="{btn} {show.blackout ? 'bg-live-soft text-live shadow-[inset_0_0_0_1px_rgba(255,82,87,0.5)]' : ''}"
      onclick={() => show.toggleBlackout()}
    >
      Blackout <kbd class={kbd}>B</kbd>
    </button>
    <button class={btn}>Логотип <kbd class={kbd}>L</kbd></button>
    <button class={btn} onclick={() => show.clear()}>Очистить <kbd class={kbd}>Esc</kbd></button>
  </div>
</div>
