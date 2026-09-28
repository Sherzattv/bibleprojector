<script lang="ts">
  import { LoaderCircle, RotateCw } from '@lucide/svelte'
  import { data } from '../../data/db.svelte'
  import { retryData } from '../../data/startup.svelte'

  /** Экран до готовности данных: загрузка или ошибка с повтором */
  let retrying = $state(false)

  async function retry() {
    if (retrying) return
    retrying = true
    try {
      await retryData()
    } finally {
      retrying = false
    }
  }
</script>

{#if data.status === 'loading'}
  <div class="grid place-items-center">
    <div class="flex flex-col items-center gap-1.5">
      <div class="flex items-center gap-2.5 text-base text-muted">
        <LoaderCircle size={18} class="animate-spin text-accent" />
        Загрузка переводов и песен…
      </div>
      <!-- Прогресса в байтах нет, но объём стоит назвать: первый запуск долгий -->
      <div class="text-xs text-faint">
        Первый запуск качает около 5 МБ, дальше данные берутся из кэша.
      </div>
    </div>
  </div>
{:else if data.status === 'error'}
  <div class="grid place-items-center">
    <div class="flex flex-col items-center gap-3">
      <div class="text-base text-live">Не удалось загрузить данные.</div>
      <button
        onclick={retry}
        disabled={retrying}
        class="flex h-7 items-center gap-1.5 rounded border border-stroke-2 bg-panel-2 px-2.5 text-sm
               font-medium text-muted hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        <RotateCw size={13} class={retrying ? 'animate-spin' : ''} />
        {retrying ? 'Повторяем…' : 'Повторить'}
      </button>
      <div class="text-xs text-faint">Проверьте соединение — данные подгружаются из сети.</div>
    </div>
  </div>
{/if}
