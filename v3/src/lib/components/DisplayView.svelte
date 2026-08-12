<script lang="ts">
  import { DisplayReceiver } from '../projector-link.svelte'
  import { bcChannel, FULLSCREEN_GRANT } from '../projector-service.svelte'
  import { autofitScale } from '../autofit'
  import type { ProjectionContent, ProjectionSettings } from '../projection'

  const receiver = new DisplayReceiver(bcChannel())
  const content = $derived(receiver.content as ProjectionContent)
  const settings = $derived(
    (receiver.settings as ProjectionSettings | null) ?? { fontScale: 1, showReference: true },
  )

  let fullscreen = $state(false)

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

  // Пульт показывает состояние окна честно: признак едет вместе с pong
  $effect(() => {
    const sync = () => {
      fullscreen = Boolean(document.fullscreenElement)
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
      document.documentElement.requestFullscreen().catch(() => {
        receiver.reportFullscreenFailed()
      })
    }
    window.addEventListener('message', onGrant)
    return () => window.removeEventListener('message', onGrant)
  })

  // Запасной путь для браузеров без делегирования: пульт просит по каналу,
  // права оно не переносит — сработает лишь там, где жеста не требуют
  receiver.onCommand = (cmd) => {
    if (cmd === 'close') window.close()
    else if (cmd === 'fullscreen' && !document.fullscreenElement) enterFullscreen()
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
  class="grid h-screen place-items-center bg-black p-[6%] text-center select-none"
  class:cursor-none={fullscreen}
  ondblclick={toggleFullscreen}
>
  {#if content.kind === 'slide'}
    <div class="max-w-[92%]">
      <div
        class="font-serif leading-[1.5] text-balance text-white"
        style="font-size: calc(clamp(28px, 4.5vw, 72px) * {settings.fontScale * autofitScale(content.text)})"
      >
        {#each content.text.split('\n') as line, i (i)}
          {line}<br />
        {/each}
      </div>
      {#if settings.showReference}
        <div
          class="mt-8 tracking-[0.12em] text-amber uppercase"
          style="font-size: calc(clamp(14px, 1.6vw, 24px) * {settings.fontScale})"
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
        style="font-size: calc(clamp(24px, 3.5vw, 56px) * {settings.fontScale * autofitScale(content.text)})"
      >
        {#each content.text.split('\n') as line, i (i)}
          {line}<br />
        {/each}
      </div>
    </div>
  {/if}
  <!-- blackout и empty — просто чёрный экран -->
</main>

<!--
  Тихого отказа быть не должно: если развернуть окно автоматически не вышло
  (истекла активация клика или браузер без Window Management API), оператор
  видит на самом экране, что делать. В полноэкранном режиме подсказки нет.
-->
{#if !fullscreen}
  <button
    onclick={enterFullscreen}
    class="fixed bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-md border border-white/25 bg-white/10
           px-4 py-2 text-sm text-white/75 backdrop-blur hover:bg-white/20 hover:text-white"
  >
    Развернуть на весь экран · двойной клик тоже
  </button>
{/if}
