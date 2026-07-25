<script lang="ts">
  import { DisplayReceiver } from '../projector-link.svelte'
  import { bcChannel } from '../projector-service.svelte'
  import type { ProjectionContent, ProjectionSettings } from '../projection'

  const receiver = new DisplayReceiver(bcChannel())
  const content = $derived(receiver.content as ProjectionContent)
  const settings = $derived(
    (receiver.settings as ProjectionSettings | null) ?? { fontScale: 1, showReference: true },
  )

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

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  }
</script>

<svelte:head><title>Bible Projector — экран</title></svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="grid h-screen cursor-none place-items-center bg-black p-[6%] text-center select-none"
  ondblclick={toggleFullscreen}
>
  {#if content.kind === 'slide'}
    <div class="max-w-[92%]">
      <div
        class="font-serif leading-[1.5] text-balance text-white"
        style="font-size: calc(clamp(28px, 4.5vw, 72px) * {settings.fontScale})"
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
        style="font-size: calc(clamp(24px, 3.5vw, 56px) * {settings.fontScale})"
      >
        {#each content.text.split('\n') as line, i (i)}
          {line}<br />
        {/each}
      </div>
    </div>
  {/if}
  <!-- blackout и empty — просто чёрный экран -->
</div>
