<script lang="ts">
  // Корень нужен ровно затем, чтобы роль окна можно было сменить без
  // перезагрузки: main.ts монтирует его один раз, а дальше окно само
  // переключается между пультом и экраном.
  import App from './App.svelte'
  import DisplayView from './lib/components/DisplayView.svelte'
  import { mode } from './lib/mode.svelte'
</script>

{#if mode.isDisplay}
  <DisplayView />
{:else}
  <App />
{/if}
