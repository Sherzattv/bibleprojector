<script lang="ts">
  import { lowerThirdText, type ProjectionContent } from '../../projection/content'
  import type { SlideTransitionParams } from '../../projection/transitions'
  import CountdownScreen from './CountdownScreen.svelte'
  import WelcomeScreen from './WelcomeScreen.svelte'

  /**
   * Вывод для трансляции: плашка внизу поверх хромакея или прозрачного фона
   * (источник «Браузер» в OBS) — подпись сверху, текст в одну-две строки.
   */
  interface Props {
    content: ProjectionContent
    fontScale: number
    showReference: boolean
    motion: SlideTransitionParams
  }
  let { content, fontScale, showReference, motion }: Props = $props()

  const caption = 'mb-[0.4em] text-[0.6em] font-semibold tracking-[0.12em] text-amber uppercase'
</script>

{#if content.kind !== 'empty' && content.kind !== 'blackout'}
  <div class="flex size-full flex-col justify-end">
    <div
      class="max-w-full self-start border-l-[0.35vw] border-amber bg-[#080a0e]/85 px-[2.2vw] py-[1.4vw] text-left"
      style="font-size: calc(clamp(16px, 2.1vw, 40px) * {fontScale})"
    >
      {#if content.kind === 'slide' || content.kind === 'note'}
        {@const title = content.kind === 'slide' ? content.reference : content.title}
        {#if title && (showReference || content.kind === 'note')}
          <div class={caption}>{title}</div>
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
          <CountdownScreen {...content} {fontScale} compact />
        </div>
      {:else if content.kind === 'welcome'}
        <div class={caption}>{content.name}</div>
        <div class="font-medium text-white">
          <WelcomeScreen {...content} {fontScale} {motion} compact />
        </div>
      {/if}
    </div>
  </div>
{/if}
