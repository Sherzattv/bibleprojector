<script lang="ts">
  import { ChevronLeft, ChevronRight, Play, SquareSlash, Image, X } from '@lucide/svelte'
  import { show } from '../show.svelte'

  const btn =
    'flex h-[30px] items-center gap-1.5 rounded-[5px] border border-stroke-2 bg-panel-2 px-3 text-xs font-medium text-muted hover:bg-hover hover:text-ink'
  const kbd = 'font-mono text-[9.5px] text-faint'
</script>

<div class="flex shrink-0 items-center gap-2 border-t border-stroke bg-panel px-4 py-2">
  <button class={btn} onclick={() => show.prev()}>
    <ChevronLeft size={14} />Назад <kbd class={kbd}>←</kbd>
  </button>
  <button class={btn} onclick={() => show.next()}>
    Вперёд<ChevronRight size={14} /> <kbd class={kbd}>→</kbd>
  </button>

  <button
    onclick={() => show.go()}
    class="mx-1 flex h-[30px] items-center gap-2 rounded-[5px] bg-go px-5 text-[12.5px] font-bold text-white hover:bg-go-hover"
  >
    <Play size={13} fill="currentColor" />GO
    <kbd class="font-mono text-[9.5px] font-normal text-white/60">Space</kbd>
  </button>

  <span class="mx-1 h-5 w-px bg-stroke-2"></span>

  <button
    class="{btn} {show.blackout ? 'border-live/50! bg-live-dim! text-live!' : ''}"
    onclick={() => show.toggleBlackout()}
  >
    <SquareSlash size={13} />Blackout <kbd class={kbd}>B</kbd>
  </button>
  <button class={btn}><Image size={13} />Логотип <kbd class={kbd}>L</kbd></button>
  <button class={btn} onclick={() => show.clear()}>
    <X size={13} />Очистить <kbd class={kbd}>Esc</kbd>
  </button>

  <span class="ml-auto text-[11px] text-faint">РСТ · Синодальный</span>
</div>
