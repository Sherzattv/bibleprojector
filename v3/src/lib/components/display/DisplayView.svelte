<script lang="ts">
  import { DisplayReceiver } from '../../projector/link.svelte'
  import { bcChannel } from '../../projector/service.svelte'
  import { presentationReceiverChannel } from '../../projector/presentation'
  import { DisplayMedia, MEDIA_RETRY_MS } from '../../projector/display-media.svelte'
  import {
    acceptFullscreenGrant,
    enterFullscreen,
    keepScreenAwake,
    reloadForUpdate,
    toggleFullscreen,
    watchFullscreen,
  } from '../../projector/display-window'
  import { autofitScale } from '../../projection/autofit'
  import { normalizeProjectionSettings, type ProjectionContent } from '../../projection/content'
  import { lineIn, slideIn, slideOut } from '../../projection/transitions'
  import MotionBackground from '../projection/MotionBackground.svelte'
  import ParallelVerse from '../projection/ParallelVerse.svelte'
  import SlideText from '../projection/SlideText.svelte'
  import CountdownScreen from './CountdownScreen.svelte'
  import WelcomeScreen from './WelcomeScreen.svelte'
  import LowerThirdScreen from './LowerThirdScreen.svelte'

  // Экран, который вывел сам браузер (Presentation API), живёт в изолированном
  // профиле: BroadcastChannel туда не добивает, сообщения ходят через
  // PresentationConnection. Обычный попап работает по-старому.
  const presentation = presentationReceiverChannel()
  const receiver = new DisplayReceiver(presentation ?? bcChannel())
  const isPresentation = presentation !== null
  if (presentation) {
    // Такой экран уже занимает весь монитор — докладываем это пульту
    receiver.fullscreen = true
    // Контроллер подключается позже старта: стартовое hello ушло в пустоту,
    // здороваемся с каждым новым соединением заново
    presentation.onOpen = () => receiver.hello()
  }
  const content = $derived(receiver.content as ProjectionContent)
  const settings = $derived(normalizeProjectionSettings(receiver.settings))
  // Тень держит буквы на светлых бликах фона; на чёрном её не видно
  const textShadow = $derived(
    settings.textShadow ? 'text-shadow: 0 0.1vw 0.8vw rgb(0 0 0 / 0.65), 0 0 0.2vw rgb(0 0 0 / 0.5);' : '',
  )

  // Кто просил систему убрать анимации, получает резкую смену
  const reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const motion = $derived({
    kind: reduceMotion ? ('cut' as const) : settings.transition,
    ms: settings.transitionMs,
  })
  // Затемнение плавное всегда, кроме «резко»: полсекунды минимум, иначе глаз
  // воспринимает его как мигание
  const blackoutMs = $derived(motion.kind === 'cut' ? 0 : Math.max(500, settings.transitionMs))

  // Ключ содержимого: меняется — играет переход. Подсветка строки (line)
  // в ключ не входит — строка перетекает сама, слайд не пересоздаётся
  // Отсчёт и заставка тоже не пересоздаются от каждого тика и паузы
  const contentKey = $derived(
    content.kind === 'slide'
      ? `slide\u0000${content.text}\u0000${content.reference}`
      : content.kind === 'note'
        ? `note\u0000${content.title}\u0000${content.text}`
        : content.kind === 'welcome'
          ? `welcome\u0000${content.name}`
          : content.kind === 'countdown'
            ? 'countdown'
            : 'none',
  )

  // Нижняя треть для трансляции: фон — хромакей или прозрачность, текст плашкой
  const lowerThird = $derived(settings.layout === 'lower-third')
  const transparent = $derived(lowerThird && settings.chroma === 'transparent')
  $effect(() => {
    // Прозрачность нужна всей странице, иначе OBS увидит фон body из app.css
    const value = transparent ? 'transparent' : ''
    document.documentElement.style.background = value
    document.body.style.background = value
  })

  // Свои файлы оператора: экран сам просит недостающее у пульта
  const media = new DisplayMedia((slot) => receiver.requestMedia(slot))
  receiver.onMedia = (payload) => media.accept(payload, settings.media)
  $effect(() => {
    const refs = settings.media
    media.sync(refs)
    const id = setInterval(() => media.sync(refs), MEDIA_RETRY_MS)
    return () => clearInterval(id)
  })

  // Замер контраста едет в пульт вместе с ближайшим pong
  function onContrast(ratio: number | null) {
    receiver.contrast = ratio === null ? null : Math.round(ratio * 10) / 10
  }

  let fullscreen = $state(isPresentation)

  $effect(keepScreenAwake)

  // Пульт показывает состояние окна честно: признак едет вместе с pong
  $effect(() =>
    watchFullscreen(isPresentation, (on) => {
      fullscreen = on
      receiver.fullscreen = on
    }),
  )

  $effect(() => acceptFullscreenGrant((reason) => receiver.reportFullscreenFailed(reason)))

  // Запасной путь для браузеров без делегирования: пульт просит по каналу,
  // права оно не переносит — сработает лишь там, где жеста не требуют
  receiver.onCommand = (cmd) => {
    if (cmd === 'close') window.close()
    else if (cmd === 'reload') reloadForUpdate()
    else if (cmd === 'fullscreen' && !document.fullscreenElement) enterFullscreen()
  }
</script>

<svelte:head><title>Bible Projector — экран</title></svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<main
  aria-label="Экран проектора"
  class="relative grid h-screen place-items-center overflow-hidden p-[6%] text-center select-none
         {!lowerThird ? 'bg-black' : transparent ? 'bg-transparent' : 'bg-[#00b140]'}"
  class:cursor-none={fullscreen}
  ondblclick={toggleFullscreen}
>
  {#if !lowerThird}
    <MotionBackground settings={settings.background} media={media.loaded.background} {onContrast} />
  {/if}

  <!-- Смена слайда — смена ключа: уходящий и входящий живут в одной ячейке
       сетки одновременно, пока идёт переход -->
  {#key contentKey}
    <div
      class="relative grid size-full place-items-center [grid-area:1/1]"
      style={textShadow}
      in:slideIn={motion}
      out:slideOut={motion}
    >
      {#if lowerThird}
        <LowerThirdScreen
          {content}
          fontScale={settings.fontScale}
          showReference={settings.showReference}
          {motion}
        />
      {:else if content.kind === 'slide' && content.secondary}
        <ParallelVerse
          primary={content}
          secondary={content.secondary}
          layout={settings.parallelLayout}
          fontFamily={settings.fontFamily}
          fontScale={settings.fontScale}
          showReference={settings.showReference}
          size="screen"
          {motion}
        />
      {:else if content.kind === 'slide'}
        <SlideText
          text={content.text}
          reference={content.reference}
          line={content.line}
          fontFamily={settings.fontFamily}
          fontScale={settings.fontScale}
          showReference={settings.showReference}
          size="screen"
          {motion}
        />
      {:else if content.kind === 'note'}
        <div class="max-w-[88%]">
          <div
            class="mb-8 font-semibold tracking-[0.1em] text-amber uppercase"
            style="font-size: calc(clamp(16px, 1.8vw, 28px) * {settings.fontScale})"
          >
            {content.title}
          </div>
          <div
            class="leading-[1.6] text-balance text-white"
            style="font-size: calc(clamp(24px, 3.5vw, 56px) * {settings.fontScale *
              autofitScale(content.text)})"
          >
            {#each content.text.split('\n') as line, i (i)}
              <span class="block" in:lineIn|global={{ ...motion, index: i }}>{line || '\u00a0'}</span>
            {/each}
          </div>
        </div>
      {:else if content.kind === 'countdown'}
        <CountdownScreen {...content} fontScale={settings.fontScale} />
      {:else if content.kind === 'welcome'}
        <WelcomeScreen
          {...content}
          fontScale={settings.fontScale}
          {motion}
          logoUrl={media.loaded.logo?.url ?? null}
        />
      {/if}
    </div>
  {/key}

  <!-- empty — только фон. Blackout — честный чёрный поверх всего и плавно:
       фон под ним не выключается, чтобы после возврата не перезапускаться рывком -->
  <!-- В нижней трети blackout — просто пустой кадр: чёрный закрыл бы трансляцию -->
  {#if !lowerThird}
    <div
      class="pointer-events-none absolute inset-0 bg-black"
      style="opacity: {content.kind === 'blackout' ? 1 : 0}; transition: opacity {blackoutMs}ms ease"
    ></div>
  {/if}
</main>

<!--
  Тихого отказа быть не должно: если развернуть окно автоматически не вышло
  (истекла активация клика или браузер без Window Management API), оператор
  видит на самом экране, что делать. В полноэкранном режиме подсказки нет.
-->
<!-- В нижней трети окно захватывает OBS — подсказка попала бы в трансляцию -->
{#if !fullscreen && !lowerThird}
  <button
    onclick={enterFullscreen}
    class="fixed bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-md border border-white/25 bg-white/10
           px-4 py-2 text-sm text-white/75 backdrop-blur hover:bg-white/20 hover:text-white"
  >
    Развернуть на весь экран · двойной клик тоже
  </button>
{/if}
