<script lang="ts">
  import { ui } from '../../ui/notices.svelte'

  /** Уведомления о тихих отказах: показываем и гасим через 4 секунды */
  const NOTICE_MS = 4000

  $effect(() => {
    if (!ui.lastNotice) return
    const id = setTimeout(() => ui.clearNotice(), NOTICE_MS)
    return () => clearTimeout(id)
  })
</script>

{#if ui.lastNotice}
  <div
    role="status"
    aria-live="polite"
    class="fixed bottom-14 left-1/2 z-50 -translate-x-1/2 rounded-md border border-live/50 bg-panel-2 px-4 py-2 text-sm text-ink shadow-xl shadow-black/50"
  >
    {ui.lastNotice}
  </div>
{/if}
