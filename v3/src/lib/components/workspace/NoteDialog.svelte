<script lang="ts">
  import { X } from '@lucide/svelte'

  /**
   * Новая заметка для экрана: заголовок и текст. Пустой заголовок —
   * «Заметка»; без текста onsave не вызывается, решает сохранение сам
   * владелец диалога и возвращает, получилось ли.
   */
  interface Props {
    open: boolean
    onsave: (title: string, text: string) => boolean
  }
  let { open = $bindable(), onsave }: Props = $props()

  let title = $state('')
  let text = $state('')

  function close() {
    open = false
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!onsave(title.trim() || 'Заметка', text.trim())) return
    title = ''
    text = ''
    close()
  }

  const field = 'w-full rounded border border-stroke-2 bg-bg text-sm text-ink focus:border-accent focus:outline-none'
</script>

{#if open}
  <button
    class="fixed inset-0 z-[80] cursor-default bg-black/65"
    onclick={close}
    aria-label="Закрыть создание заметки"
  ></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="new-note-title"
    class="fixed top-1/2 left-1/2 z-[81] w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2
           rounded-md border border-stroke-2 bg-panel-2 p-4 shadow-2xl"
  >
    <form onsubmit={submit}>
      <div class="mb-3 flex items-center justify-between">
        <h2 id="new-note-title" class="text-base font-semibold">Новая заметка</h2>
        <button
          type="button"
          class="grid size-7 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
          onclick={close}
          aria-label="Закрыть"
        ><X size={14} /></button>
      </div>
      <label class="mb-3 block text-xs text-muted">
        Заголовок
        <input bind:value={title} class="mt-1 h-8 px-2.5 {field}" placeholder="Например: Объявления" />
      </label>
      <label class="block text-xs text-muted">
        Текст
        <textarea
          bind:value={text}
          class="mt-1 h-32 resize-y p-2.5 leading-5 {field}"
          placeholder="Текст для экрана проектора"
        ></textarea>
      </label>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="h-8 rounded border border-stroke-2 px-3 text-sm text-muted hover:bg-hover"
          onclick={close}
        >Отмена</button>
        <button type="submit" class="h-8 rounded bg-accent px-4 text-sm font-semibold text-white hover:brightness-110">
          Добавить
        </button>
      </div>
    </form>
  </div>
{/if}
