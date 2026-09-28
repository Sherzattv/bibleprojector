<script lang="ts">
  import { ArrowDownToLine } from '@lucide/svelte'
  import { getProjectorLink } from '../projector-service.svelte'

  /** Сколько ждём второго нажатия, прежде чем снять вопрос «Точно?» */
  const CONFIRM_MS = 4000

  const projector = getProjectorLink()

  let updateReady = $state(false)
  let updateConfirm = $state(false)

  // Новый SW скачался и ждёт в waiting: применится сам, когда закроют все окна
  // приложения (skipWaiting: false в vite.config.ts), или сразу — кнопкой
  // «Обновить». Посреди служения случайный клик не должен перезагрузить экран,
  // поэтому кнопка просит подтверждения вторым нажатием.
  $effect(() => {
    const onUpdateReady = () => (updateReady = true)
    window.addEventListener('bp3:update-ready', onUpdateReady)
    return () => window.removeEventListener('bp3:update-ready', onUpdateReady)
  })

  /**
   * Обновить сейчас. Экран проектора перезагружается сам, когда новый SW
   * возьмёт управление, — иначе пульт и экран разошлись бы по версиям.
   * Cmd+Shift+R здесь не помог бы: он обходит кэш только для одной страницы
   * и не активирует ждущий Service Worker.
   */
  function applyUpdate() {
    if (!updateConfirm) {
      updateConfirm = true
      setTimeout(() => (updateConfirm = false), CONFIRM_MS)
      return
    }
    projector.command('reload')
    window.dispatchEvent(new CustomEvent('bp3:apply-update'))
  }
</script>

{#if updateReady}
  <button
    onclick={applyUpdate}
    class="app-update flex h-7 shrink-0 items-center gap-1.5 rounded border px-2.5 text-sm
           {updateConfirm
      ? 'border-accent bg-accent-dim text-ink'
      : 'border-stroke-2 bg-panel-2 text-muted hover:bg-hover hover:text-ink'}"
    aria-live="polite"
    title="Новая версия загружена. Нажмите, чтобы обновить пульт и экран проектора сейчас, — или она установится сама, когда закроете все окна приложения."
  >
    <ArrowDownToLine size={12} />
    <span>{updateConfirm ? 'Точно? Экран перезагрузится' : 'Обновить'}</span>
  </button>
{/if}
