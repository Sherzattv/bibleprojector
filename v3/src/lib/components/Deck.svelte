<script lang="ts">
  import { Pencil, Check, X } from '@lucide/svelte'
  import { show, type ShowSlide } from '../show.svelte'
  import { projSettings } from '../proj-settings.svelte'

  interface Props {
    mode: 'preview' | 'live'
    slide: ShowSlide | null
    blackout?: boolean
  }
  let { mode, slide, blackout = false }: Props = $props()
  const isLive = mode === 'live'

  let editing = $state(false)
  let draft = $state('')

  function startEdit() {
    if (!slide) return
    draft = slide.text
    editing = true
  }
  function saveEdit() {
    show.updateSlideText(show.previewIdx, draft)
    editing = false
  }
</script>

<div class="bg-bg p-3">
  <div class="mb-1.5 flex items-center justify-between">
    <span class="text-xs font-semibold tracking-wide uppercase {isLive ? 'text-live' : 'text-muted'}">
      {isLive ? 'Эфир' : 'Превью'}
    </span>
    {#if isLive}
      <span class="flex items-center gap-1.5 text-xs font-medium {slide || blackout ? 'text-live' : 'text-faint'}">
        {#if slide || blackout}<span class="size-1.5 rounded-full bg-live"></span>{/if}
        {blackout ? 'blackout' : slide ? 'идёт показ' : 'пусто'}
      </span>
    {:else if editing}
      <span class="flex items-center gap-1">
        <button
          class="flex h-5 items-center gap-1 rounded border border-stroke-2 px-1.5 text-2xs font-medium text-go hover:bg-hover"
          onclick={saveEdit}
        >
          <Check size={11} />Сохранить
        </button>
        <button
          class="flex h-5 items-center gap-1 rounded border border-stroke-2 px-1.5 text-2xs font-medium text-muted hover:bg-hover"
          onclick={() => (editing = false)}
        >
          <X size={11} />Отмена
        </button>
      </span>
    {:else}
      <span class="flex items-center gap-2">
        <span class="text-xs text-faint">{slide ? slide.label.toLowerCase() : '—'}</span>
        {#if slide}
          <button
            class="grid size-5 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
            onclick={startEdit}
            title="Редактировать текст слайда"
          >
            <Pencil size={11} />
          </button>
        {/if}
      </span>
    {/if}
  </div>

  <div
    class="projection relative grid aspect-video place-items-center overflow-hidden rounded-md border p-[5%] text-center
           {isLive && slide ? 'border-live/60' : 'border-stroke-2'}"
  >
    {#if editing && !isLive}
      <textarea
        bind:value={draft}
        class="h-full w-full resize-none bg-transparent text-center font-serif text-sm leading-[1.55] text-white focus:outline-none"
        onkeydown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit()
          if (e.key === 'Escape') {
            e.stopPropagation()
            editing = false
          }
        }}
      ></textarea>
    {:else if !blackout && slide}
      <div class="max-w-[94%]">
        <div
          class="font-serif leading-[1.55] text-balance text-white"
          style="font-size: calc(clamp(12px, 1.3vw, 18px) * {projSettings.fontScale})"
        >
          {#each slide.text.split('\n') as line, i (i)}
            {line}<br />
          {/each}
        </div>
        {#if projSettings.showReference}
          <div class="mt-2 text-amber" style="font-size: calc(clamp(9px, 0.75vw, 11px) * {projSettings.fontScale})">
            {slide.reference}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
