<script lang="ts">
  import { ChevronLeft, ChevronRight, Play, SquareSlash, Image, X } from '@lucide/svelte'
  import { show } from '../show.svelte'
  import { data, TRANSLATIONS } from '../db.svelte'

  const btn =
    'flex h-7 items-center gap-1.5 rounded border border-stroke-2 bg-panel-2 px-2.5 text-sm font-medium text-muted hover:bg-hover hover:text-ink disabled:opacity-40 disabled:pointer-events-none'
  const kbd = 'font-mono text-2xs text-faint'

  function changeTranslation(e: Event) {
    data.translation = (e.target as HTMLSelectElement).value
    show.reloadForTranslation()
  }
</script>

<div class="flex shrink-0 items-center gap-2 border-t border-stroke bg-panel px-3 py-2">
  <button class={btn} onclick={() => show.prev()} disabled={!show.slides.length}>
    <ChevronLeft size={14} />Назад <kbd class={kbd}>←</kbd>
  </button>
  <button class={btn} onclick={() => show.next()} disabled={!show.slides.length}>
    Вперёд<ChevronRight size={14} /> <kbd class={kbd}>→</kbd>
  </button>

  <button
    onclick={() => show.go()}
    disabled={!show.slides.length}
    class="mx-1 flex h-7 items-center gap-2 rounded bg-go px-4 text-sm font-bold text-white hover:bg-go-hover disabled:pointer-events-none disabled:opacity-40"
  >
    <Play size={13} fill="currentColor" />GO
    <kbd class="font-mono text-2xs font-normal text-white/60">Space</kbd>
  </button>

  <span class="mx-1 h-5 w-px bg-stroke-2"></span>

  <button
    class="{btn} {show.blackout ? 'border-live/50! bg-live-dim! text-live!' : ''}"
    onclick={() => show.toggleBlackout()}
  >
    <SquareSlash size={13} />Blackout <kbd class={kbd}>B</kbd>
  </button>
  <button class={btn}><Image size={13} />Логотип <kbd class={kbd}>L</kbd></button>
  <button class={btn} onclick={() => show.clear()} disabled={show.liveIdx < 0}>
    <X size={13} />Очистить <kbd class={kbd}>Esc</kbd>
  </button>

  <label class="ml-auto flex items-center gap-1.5 text-xs text-faint">
    Перевод
    <select
      value={data.translation}
      onchange={changeTranslation}
      class="h-7 rounded border border-stroke-2 bg-panel-2 px-1.5 text-sm font-medium text-muted
             hover:text-ink focus:border-accent focus:outline-none"
    >
      {#each TRANSLATIONS as [code, label] (code)}
        <option value={code} disabled={!data.bibles[code]}>
          {code} · {label}{data.bibles[code] ? '' : ' (загрузка…)'}
        </option>
      {/each}
    </select>
  </label>
</div>
