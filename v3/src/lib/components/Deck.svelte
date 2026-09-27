<script lang="ts">
  import { Pencil, Check, X } from '@lucide/svelte'
  import { show, type ShowSlide } from '../show.svelte'
  import { projSettings } from '../proj-settings.svelte'
  import { autofitScale } from '../autofit'
  import { backgroundPreviewCss, isAnimated } from '../backgrounds/settings'
  import { FONT_SIZE_FACTOR, LINE_OPACITY, lineStates } from '../projection'
  import { serviceScreen } from '../service-screen.svelte'
  import { mediaLibrary } from '../media-library.svelte'

  interface Props {
    mode: 'preview' | 'live'
    slide: ShowSlide | null
    blackout?: boolean
  }
  let { mode, slide, blackout = false }: Props = $props()
  const isLive = $derived(mode === 'live')

  // Превью фона — статичная CSS-копия палитры: настоящий шейдер крутится
  // только на проекторе, видеокарта у пульта и экрана общая
  const bg = $derived(projSettings.background)
  // Своё фото показываем как есть; для видео — палитра (кадр в превью не нужен)
  const ownImage = $derived(bg.preset === 'media' ? mediaLibrary.previews.background : null)
  const backdrop = $derived(
    blackout
      ? 'background: #000'
      : ownImage
        ? `background: #000 url("${ownImage}") center / cover no-repeat`
        : `background: ${backgroundPreviewCss(bg)}`,
  )
  // Подсветка строки видна и в карточке эфира — оператор знает, где зал
  const line = $derived(
    isLive && projSettings.lineHighlight && show.kind === 'song' ? show.liveLine : undefined,
  )
  const dim = $derived(!blackout && isAnimated(bg) ? bg.dim : 0)

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

<section class="bg-bg p-3" aria-label={isLive ? 'Эфир' : 'Предпросмотр'}>
  <div class="mb-1.5 flex items-center justify-between">
    <span class="text-xs font-semibold tracking-wide uppercase {isLive ? 'text-live' : 'text-muted'}">
      {isLive ? 'Эфир' : 'Превью'}
    </span>
    {#if isLive}
      {@const onAir = slide || blackout || serviceScreen.mode !== 'off'}
      <span class="flex items-center gap-1.5 text-xs font-medium {onAir ? 'text-live' : 'text-faint'}">
        {#if onAir}<span class="size-1.5 rounded-full bg-live"></span>{/if}
        {blackout
          ? 'blackout'
          : serviceScreen.mode !== 'off'
            ? 'заставка'
            : slide
              ? 'идёт показ'
              : 'пусто'}
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
    style={backdrop}
  >
    {#if dim}
      <div class="pointer-events-none absolute inset-0 bg-black" style="opacity: {dim}"></div>
    {/if}
    {#if editing && !isLive}
      <textarea
        bind:value={draft}
        class="relative h-full w-full resize-none bg-transparent text-center font-serif text-sm leading-[1.55] text-white focus:outline-none"
        onkeydown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveEdit()
          if (e.key === 'Escape') {
            e.stopPropagation()
            editing = false
          }
        }}
      ></textarea>
    {:else if isLive && !blackout && serviceScreen.mode !== 'off'}
      <!-- Заставка перекрывает слайд — карточка эфира не должна врать -->
      <div class="relative text-sm text-white/80">
        {serviceScreen.mode === 'countdown' ? 'Отсчёт до начала' : serviceScreen.churchName || 'Экран ожидания'}
      </div>
    {:else if !blackout && slide}
      <div class="relative max-w-[94%]">
        <div
          class="leading-[1.55] text-balance text-white {projSettings.fontFamily === 'sans'
            ? 'font-sans font-medium'
            : 'font-serif'}"
          style="font-size: calc(clamp(12px, 1.3vw, 18px) * {projSettings.fontScale *
            FONT_SIZE_FACTOR[projSettings.fontFamily] *
            autofitScale(slide.text)})"
        >
          {#each lineStates(slide.text, line) as l, i (i)}
            <span
              class="block transition-opacity duration-500"
              style={l.state ? `opacity: ${LINE_OPACITY[l.state]}` : ''}>{l.text || '\u00a0'}</span
            >
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
</section>
