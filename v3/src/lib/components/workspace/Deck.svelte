<script lang="ts">
  import { Pencil, Check, X } from '@lucide/svelte'
  import { show, type ShowSlide } from '../../show/show.svelte'
  import { projSettings } from '../../projection/settings.svelte'
  import MotionBackground from '../projection/MotionBackground.svelte'
  import ParallelVerse from '../projection/ParallelVerse.svelte'
  import SlideText from '../projection/SlideText.svelte'
  import { CHROMA_BACKGROUND, lowerThirdText } from '../../projection/content'
  import { serviceScreen } from '../../projection/service-screen.svelte'
  import { mediaLibrary } from '../../media/library.svelte'

  interface Props {
    mode: 'preview' | 'live'
    slide: ShowSlide | null
    blackout?: boolean
  }
  let { mode, slide, blackout = false }: Props = $props()
  const isLive = $derived(mode === 'live')

  // В карточке — тот же живой фон, что на проекторе, но облегчённый: карточка
  // маленькая, поэтому половина разрешения и не больше 30 к/с. Прежняя
  // CSS-копия из трёх пятен палитры не похожа ни на горы, ни на свечи.
  const cardBackground = $derived({
    ...projSettings.background,
    quality: 0.5 as const,
    fps: 30 as const,
  })
  // Вывод «нижняя треть» — карточки показывают то же, что уходит в трансляцию
  const lowerThird = $derived(projSettings.layout === 'lower-third')
  const cardStyle = $derived(
    `background: ${lowerThird && !blackout ? CHROMA_BACKGROUND[projSettings.chroma] : '#000'}`,
  )
  const serviceOnAir = $derived(isLive && serviceScreen.mode !== 'off')
  const ownMedia = $derived.by(() => {
    const ref = mediaLibrary.refs.background
    const url = mediaLibrary.previews.background
    return ref && url ? { url, kind: ref.kind } : null
  })
  // Подсветка строки видна и в карточке эфира — оператор знает, где зал
  const line = $derived(
    isLive && projSettings.lineHighlight && show.kind === 'song' ? show.liveLine : undefined,
  )

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
    style={cardStyle}
  >
    {#if !blackout && !lowerThird}
      <MotionBackground settings={cardBackground} media={ownMedia} />
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
    {:else if lowerThird && !blackout && (serviceOnAir || slide)}
      <!-- Плашка внизу, как на выходе для OBS -->
      <div class="absolute inset-x-[5%] bottom-[6%] flex">
        <div class="max-w-full border-l-2 border-amber bg-[#080a0e]/85 px-2 py-1.5 text-left">
          {#if serviceOnAir}
            <div class="text-2xs font-medium text-white">
              {serviceScreen.mode === 'countdown' ? serviceScreen.title : serviceScreen.churchName}
            </div>
          {:else if slide}
            {#if projSettings.showReference}
              <div class="text-2xs font-semibold tracking-wide text-amber uppercase">{slide.reference}</div>
            {/if}
            <div class="text-xs leading-snug font-medium text-white">{lowerThirdText(slide.text, line)}</div>
            {#if slide.secondary}
              <div class="text-2xs leading-snug text-white/80">
                {lowerThirdText(slide.secondary.text, undefined)}
              </div>
            {/if}
          {/if}
        </div>
      </div>
    {:else if serviceOnAir && !blackout}
      <!-- Заставка перекрывает слайд — карточка эфира не должна врать -->
      <div class="relative text-sm text-white/80">
        {serviceScreen.mode === 'countdown' ? 'Отсчёт до начала' : serviceScreen.churchName || 'Экран ожидания'}
      </div>
    {:else if !blackout && slide?.secondary}
      <div class="relative flex w-full justify-center">
        <ParallelVerse
          primary={slide}
          secondary={slide.secondary}
          layout={projSettings.parallelLayout}
          fontFamily={projSettings.fontFamily}
          fontScale={projSettings.fontScale}
          showReference={projSettings.showReference}
          size="card"
        />
      </div>
    {:else if !blackout && slide}
      <SlideText
        text={slide.text}
        reference={slide.reference}
        {line}
        fontFamily={projSettings.fontFamily}
        fontScale={projSettings.fontScale}
        showReference={projSettings.showReference}
        size="card"
      />
    {/if}
  </div>
</section>
