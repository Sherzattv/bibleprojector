<script lang="ts">
  import { DisplayReceiver } from '../projector-link.svelte'
  import { bcChannel, FULLSCREEN_GRANT } from '../projector-service.svelte'
  import { presentationReceiverChannel } from '../presentation'
  import { autofitScale } from '../autofit'
  import {
    FONT_SIZE_FACTOR,
    LINE_OPACITY,
    lineStates,
    lowerThirdText,
    normalizeProjectionSettings,
    type ProjectionContent,
  } from '../projection'
  import { lineIn, slideIn, slideOut } from '../transitions'
  import MotionBackground from './MotionBackground.svelte'
  import CountdownScreen from './CountdownScreen.svelte'
  import WelcomeScreen from './WelcomeScreen.svelte'
  import ParallelVerse from './ParallelVerse.svelte'
  import { MEDIA_SLOTS, type MediaSlot } from '../media'

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


  // Свои файлы оператора: в настройках едут только версии, сам файл экран
  // просит у пульта отдельно. Ответ приходит data-URL'ом — превращаем в
  // object URL, чтобы видео не держало в DOM строку на десятки мегабайт
  type Loaded = { version: string; url: string; kind: 'image' | 'video' }
  let loaded = $state<Record<MediaSlot, Loaded | null>>({ background: null, logo: null })
  const requestedAt: Record<MediaSlot, number> = { background: 0, logo: 0 }
  /** Не дождались ответа (пульт перезапускали) — спросим снова через столько */
  const MEDIA_RETRY_MS = 4000

  function drop(slot: MediaSlot) {
    const old = loaded[slot]
    if (old) URL.revokeObjectURL(old.url)
    loaded = { ...loaded, [slot]: null }
  }

  receiver.onMedia = async (m) => {
    const ref = settings.media[m.slot]
    if (!m.dataUrl) return drop(m.slot)
    if (!ref || ref.version !== m.version || loaded[m.slot]?.version === m.version) return
    try {
      const blob = await (await fetch(m.dataUrl)).blob()
      drop(m.slot)
      loaded = { ...loaded, [m.slot]: { version: m.version, url: URL.createObjectURL(blob), kind: ref.kind } }
    } catch {
      // Битый файл — останется фон палитры, запрос повторится по таймеру
    }
  }

  function syncMedia() {
    for (const slot of MEDIA_SLOTS) {
      const ref = settings.media[slot]
      if (!ref) {
        if (loaded[slot]) drop(slot)
        continue
      }
      if (loaded[slot]?.version === ref.version) continue
      if (Date.now() - requestedAt[slot] < MEDIA_RETRY_MS) continue
      requestedAt[slot] = Date.now()
      receiver.requestMedia(slot)
    }
  }
  $effect(() => {
    void settings.media
    syncMedia()
    const id = setInterval(syncMedia, MEDIA_RETRY_MS)
    return () => clearInterval(id)
  })

  // Замер контраста едет в пульт вместе с ближайшим pong
  function onContrast(ratio: number | null) {
    receiver.contrast = ratio === null ? null : Math.round(ratio * 10) / 10
  }

  let fullscreen = $state(isPresentation)

  // Экран проектора не должен засыпать во время служения
  $effect(() => {
    let lock: { release?: () => Promise<void> } | undefined
    navigator.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => {
      void lock?.release?.()
    }
  })

  // Пульт показывает состояние окна честно: признак едет вместе с pong.
  // Экран от Presentation API развёрнут всегда — fullscreenchange там не бывает
  $effect(() => {
    const sync = () => {
      fullscreen = isPresentation || Boolean(document.fullscreenElement)
      receiver.fullscreen = fullscreen
    }
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  })

  function enterFullscreen() {
    void document.documentElement.requestFullscreen().catch(() => {})
  }

  // Пульт передал право развернуться вместе с сообщением (capability delegation).
  // Активацию нужно потратить не отходя от обработчика — любой await до вызова
  // её теряет, поэтому requestFullscreen идёт здесь же, синхронно.
  $effect(() => {
    const onGrant = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data !== FULLSCREEN_GRANT) return
      if (document.fullscreenElement) return
      document.documentElement.requestFullscreen().catch((err: unknown) => {
        const reason =
          err instanceof Error ? `${err.name}: ${err.message}` : String(err ?? 'unknown')
        receiver.reportFullscreenFailed(reason)
      })
    }
    window.addEventListener('message', onGrant)
    return () => window.removeEventListener('message', onGrant)
  })

  // Запасной путь для браузеров без делегирования: пульт просит по каналу,
  // права оно не переносит — сработает лишь там, где жеста не требуют
  receiver.onCommand = (cmd) => {
    if (cmd === 'close') window.close()
    else if (cmd === 'reload') reloadForUpdate()
    else if (cmd === 'fullscreen' && !document.fullscreenElement) enterFullscreen()
  }

  /**
   * Пульт ставит новую версию. Попап живёт под тем же Service Worker'ом —
   * ждём, пока новый возьмёт управление, иначе перезагрузка поднимет старую
   * оболочку. Экран Presentation API грузится из сети — ему ждать нечего.
   */
  function reloadForUpdate() {
    const sw = navigator.serviceWorker
    if (!sw?.controller) {
      location.reload()
      return
    }
    sw.addEventListener('controllerchange', () => location.reload(), { once: true })
    // Страховка: если смена не пришла, всё равно перезагрузиться
    setTimeout(() => location.reload(), 5000)
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else enterFullscreen()
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
    <MotionBackground settings={settings.background} media={loaded.background} {onContrast} />
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
        {#if content.kind !== 'empty' && content.kind !== 'blackout'}
          <!-- Плашка внизу: подпись сверху, текст в одну-две строки -->
          <div class="flex size-full flex-col justify-end">
            <div
              class="max-w-full self-start border-l-[0.35vw] border-amber bg-[#080a0e]/85 px-[2.2vw] py-[1.4vw] text-left"
              style="font-size: calc(clamp(16px, 2.1vw, 40px) * {settings.fontScale})"
            >
              {#if content.kind === 'slide' || content.kind === 'note'}
                {@const caption = content.kind === 'slide' ? content.reference : content.title}
                {#if caption && (settings.showReference || content.kind === 'note')}
                  <div class="mb-[0.4em] text-[0.6em] font-semibold tracking-[0.12em] text-amber uppercase">
                    {caption}
                  </div>
                {/if}
                <div class="leading-[1.35] font-medium text-white">
                  {lowerThirdText(content.text, content.kind === 'slide' ? content.line : undefined)}
                </div>
                {#if content.kind === 'slide' && content.secondary}
                  <!-- Второй перевод — строкой ниже, чуть тише -->
                  <div class="mt-[0.3em] text-[0.85em] leading-[1.35] text-white/80">
                    {lowerThirdText(content.secondary.text, undefined)}
                  </div>
                {/if}
              {:else if content.kind === 'countdown'}
                <div class="font-medium text-white">
                  <CountdownScreen {...content} fontScale={settings.fontScale} compact />
                </div>
              {:else if content.kind === 'welcome'}
                <div class="mb-[0.4em] text-[0.6em] font-semibold tracking-[0.12em] text-amber uppercase">
                  {content.name}
                </div>
                <div class="font-medium text-white">
                  <WelcomeScreen {...content} fontScale={settings.fontScale} {motion} compact />
                </div>
              {/if}
            </div>
          </div>
        {/if}
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
        <div class="max-w-[92%]">
          <div
            class="leading-[1.5] text-balance text-white {settings.fontFamily === 'sans'
              ? 'font-sans font-medium'
              : 'font-serif'}"
            style="font-size: calc(clamp(28px, 4.5vw, 72px) * {settings.fontScale *
              FONT_SIZE_FACTOR[settings.fontFamily] *
              autofitScale(content.text)})"
          >
            {#each lineStates(content.text, content.line) as line, i (i)}
              <span
                class="block transition-opacity duration-500"
                style={line.state ? `opacity: ${LINE_OPACITY[line.state]}` : ''}
                in:lineIn|global={{ ...motion, index: i }}>{line.text || '\u00a0'}</span
              >
            {/each}
          </div>
          {#if settings.showReference}
            <div
              class="mt-8 tracking-[0.12em] text-amber uppercase"
              style="font-size: calc(clamp(14px, 1.6vw, 24px) * {settings.fontScale})"
              in:lineIn|global={{ ...motion, index: content.text.split('\n').length }}
            >
              {content.reference}
            </div>
          {/if}
        </div>
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
          logoUrl={loaded.logo?.url ?? null}
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
