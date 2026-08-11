<script lang="ts">
  import {
    Music,
    BookOpen,
    StickyNote,
    Plus,
    ChevronUp,
    ChevronDown,
    Download,
    Upload,
    Trash2,
    X,
    PanelRightClose,
    PanelRightOpen,
  } from '@lucide/svelte'
  import { setlist } from '../setlist.svelte'
  import { ui } from '../ui.svelte'

  interface Props {
    open: boolean
    onToggle: () => void
  }
  let { open, onToggle }: Props = $props()

  const icons = { song: Music, bible: BookOpen, note: StickyNote } as const
  let fileInput = $state<HTMLInputElement>()
  let noteOpen = $state(false)
  let noteTitle = $state('')
  let noteText = $state('')

  function itemCountLabel(count: number) {
    const mod100 = count % 100
    const mod10 = count % 10
    const noun =
      mod100 >= 11 && mod100 <= 14
        ? 'элементов'
        : mod10 === 1
          ? 'элемент'
          : mod10 >= 2 && mod10 <= 4
            ? 'элемента'
            : 'элементов'
    return `${count} ${noun}`
  }

  function downloadSetlist() {
    const blob = new Blob([setlist.exportJson()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bible-projector-setlist-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importSetlist(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    const ok = setlist.importJson(await file.text())
    ui.notify(ok ? `Импортировано: ${setlist.items.length}` : 'Не удалось импортировать порядок')
  }

  function clearSetlist() {
    if (!setlist.items.length) return
    if (confirm('Очистить весь порядок служения?')) setlist.clear()
  }

  function saveNote() {
    const title = noteTitle.trim() || 'Заметка'
    const text = noteText.trim()
    if (!text) {
      ui.notify('Введите текст заметки')
      return
    }
    if (setlist.add({ kind: 'note', title, text })) {
      setlist.open(setlist.items.length - 1)
      noteOpen = false
      noteTitle = ''
      noteText = ''
    }
  }
</script>

<aside class="flex min-h-0 flex-col bg-panel" aria-label="Порядок служения">
  {#if open}
    <div class="flex h-9 shrink-0 items-center justify-between border-b border-stroke pr-1 pl-3">
      <span class="text-xs font-semibold tracking-wide text-muted uppercase">Порядок служения</span>
      <span class="flex items-center gap-0.5">
        <button
          class="flex h-7 items-center gap-1 rounded px-1.5 text-sm font-medium text-accent hover:bg-hover"
          onclick={() => setlist.addCurrent()}
          title="Добавить текущий материал"
        >
          <Plus size={13} />Добавить
        </button>
        <button
          class="grid size-7 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
          onclick={onToggle}
          title="Свернуть панель"
        >
          <PanelRightClose size={14} />
        </button>
      </span>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto py-1" role="list">
      {#each setlist.items as item, i (i)}
        {@const Icon = icons[item.kind]}
        <div
          role="listitem"
          class="group flex items-center border-l-2
                 {i === setlist.currentIdx ? 'border-accent bg-active' : 'border-transparent hover:bg-hover'}"
        >
          <button
            onclick={() => setlist.open(i)}
            class="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-1 pl-2.5 text-left"
          >
            <Icon size={15} class={i === setlist.currentIdx ? 'shrink-0 text-accent' : 'shrink-0 text-faint'} />
            <span class="min-w-0">
              <span class="block truncate text-base font-medium">{item.title}</span>
              <span class="block text-xs text-faint">
                {item.kind === 'song' ? 'Песня' : item.kind === 'bible' ? 'Библия' : 'Заметка'}
              </span>
            </span>
          </button>
          <span class="setlist-row-tools mr-1 hidden shrink-0 items-center group-hover:flex group-focus-within:flex">
            <button
              class="grid size-6 place-items-center rounded text-faint hover:bg-panel-2 hover:text-muted disabled:opacity-25"
              onclick={() => setlist.move(i, -1)}
              disabled={i === 0}
              title="Выше"
              aria-label="Переместить «{item.title}» выше"
            ><ChevronUp size={12} /></button>
            <button
              class="grid size-6 place-items-center rounded text-faint hover:bg-panel-2 hover:text-muted disabled:opacity-25"
              onclick={() => setlist.move(i, 1)}
              disabled={i === setlist.items.length - 1}
              title="Ниже"
              aria-label="Переместить «{item.title}» ниже"
            ><ChevronDown size={12} /></button>
            <button
              class="grid size-6 place-items-center rounded text-faint hover:bg-live-dim hover:text-live"
              onclick={() => setlist.remove(i)}
              title="Удалить"
              aria-label="Удалить «{item.title}»"
            ><X size={12} /></button>
          </span>
        </div>
      {:else}
        <div class="px-4 py-8 text-center text-xs leading-5 text-faint">
          Выберите стих, песню или заметку<br />и нажмите «Добавить»
        </div>
      {/each}
    </div>

    <div class="flex h-9 shrink-0 items-center gap-0.5 border-t border-stroke px-2 text-xs text-faint">
      <span class="mr-auto pl-1">{itemCountLabel(setlist.items.length)}</span>
      <button
        class="grid size-7 place-items-center rounded hover:bg-hover hover:text-muted"
        onclick={() => (noteOpen = true)}
        title="Новая заметка"
        aria-label="Создать заметку"
      ><StickyNote size={13} /></button>
      <button
        class="grid size-7 place-items-center rounded hover:bg-hover hover:text-muted"
        onclick={downloadSetlist}
        disabled={!setlist.items.length}
        title="Экспортировать JSON"
        aria-label="Экспортировать порядок"
      ><Download size={13} /></button>
      <button
        class="grid size-7 place-items-center rounded hover:bg-hover hover:text-muted"
        onclick={() => fileInput?.click()}
        title="Импортировать JSON"
        aria-label="Импортировать порядок"
      ><Upload size={13} /></button>
      <button
        class="grid size-7 place-items-center rounded hover:bg-live-dim hover:text-live"
        onclick={clearSetlist}
        disabled={!setlist.items.length}
        title="Очистить"
        aria-label="Очистить порядок"
      ><Trash2 size={13} /></button>
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={importSetlist} />
    </div>
  {:else}
    <div class="flex h-9 shrink-0 items-center justify-center border-b border-stroke">
      <button
        class="grid size-7 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
        onclick={onToggle}
        title="Развернуть панель"
      >
        <PanelRightOpen size={14} />
      </button>
    </div>
    <div class="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto py-1.5">
      {#each setlist.items as item, i (i)}
        {@const Icon = icons[item.kind]}
        <button
          onclick={() => setlist.open(i)}
          title={item.title}
          class="grid size-8 shrink-0 place-items-center rounded
                 {i === setlist.currentIdx ? 'bg-active text-accent' : 'text-faint hover:bg-hover'}"
        >
          <Icon size={15} />
        </button>
      {/each}
    </div>
  {/if}
</aside>

{#if noteOpen}
  <button
    class="fixed inset-0 z-[80] cursor-default bg-black/65"
    onclick={() => (noteOpen = false)}
    aria-label="Закрыть создание заметки"
  ></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="new-note-title"
    class="fixed top-1/2 left-1/2 z-[81] w-[min(92vw,460px)] -translate-x-1/2 -translate-y-1/2
           rounded-md border border-stroke-2 bg-panel-2 p-4 shadow-2xl"
  >
    <form
      onsubmit={(event) => {
        event.preventDefault()
        saveNote()
      }}
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 id="new-note-title" class="text-base font-semibold">Новая заметка</h2>
        <button
          type="button"
          class="grid size-7 place-items-center rounded text-faint hover:bg-hover hover:text-muted"
          onclick={() => (noteOpen = false)}
          aria-label="Закрыть"
        ><X size={14} /></button>
      </div>
      <label class="mb-3 block text-xs text-muted">
        Заголовок
        <input
          bind:value={noteTitle}
          class="mt-1 h-8 w-full rounded border border-stroke-2 bg-bg px-2.5 text-sm text-ink focus:border-accent focus:outline-none"
          placeholder="Например: Объявления"
        />
      </label>
      <label class="block text-xs text-muted">
        Текст
        <textarea
          bind:value={noteText}
          class="mt-1 h-32 w-full resize-y rounded border border-stroke-2 bg-bg p-2.5 text-sm leading-5 text-ink focus:border-accent focus:outline-none"
          placeholder="Текст для экрана проектора"
        ></textarea>
      </label>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="h-8 rounded border border-stroke-2 px-3 text-sm text-muted hover:bg-hover"
          onclick={() => (noteOpen = false)}
        >Отмена</button>
        <button type="submit" class="h-8 rounded bg-accent px-4 text-sm font-semibold text-white hover:brightness-110">
          Добавить
        </button>
      </div>
    </form>
  </div>
{/if}
