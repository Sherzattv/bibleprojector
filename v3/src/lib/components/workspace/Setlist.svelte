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
    Palette,
  } from '@lucide/svelte'
  import { setlist } from '../../show/setlist.svelte'
  import { ui } from '../../ui/notices.svelte'
  import { projSettings } from '../../projection/settings.svelte'
  import { findPreset } from '../../backgrounds/catalog'
  import PaletteSwatch from '../ui/PaletteSwatch.svelte'
  import { countLabel } from '../../utils/format'
  import { downloadText } from '../../utils/download'
  import NoteDialog from './NoteDialog.svelte'
  import { DEFAULT_SONG_LANG, songLangInfo, songLangOf } from '../../songs/languages'
  import type { SetlistEntry } from '../../show/setlist.svelte'

  /** Подпись типа пункта; у песен не по-русски — ещё и язык базы */
  function kindLabel(item: SetlistEntry): string {
    if (item.kind === 'bible') return 'Библия'
    if (item.kind === 'note') return 'Заметка'
    const lang = songLangOf(item.id)
    return lang === DEFAULT_SONG_LANG ? 'Песня' : `Песня · ${songLangInfo(lang).label}`
  }

  /** Привязать к пункту текущий фон экрана или снять привязку */
  function toggleItemBackground(i: number) {
    const item = setlist.items[i]
    if (!item) return
    if (item.background) {
      setlist.setBackground(i, null)
      ui.notify(`Фон снят с «${item.title}»`)
      return
    }
    const { preset, palette } = projSettings.background
    setlist.setBackground(i, { preset, palette })
    ui.notify(`«${item.title}» — фон «${findPreset(preset).name}» включится с первым GO`)
  }

  interface Props {
    open: boolean
    onToggle: () => void
  }
  let { open, onToggle }: Props = $props()

  const icons = { song: Music, bible: BookOpen, note: StickyNote } as const
  let fileInput = $state<HTMLInputElement>()
  let noteOpen = $state(false)

  function downloadSetlist() {
    const date = new Date().toISOString().slice(0, 10)
    downloadText(`bible-projector-setlist-${date}.json`, setlist.exportJson(), 'application/json')
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

  /** Заметка сразу встаёт в конец порядка и открывается в превью */
  function saveNote(title: string, text: string): boolean {
    if (!text) {
      ui.notify('Введите текст заметки')
      return false
    }
    if (!setlist.add({ kind: 'note', title, text })) return false
    setlist.open(setlist.items.length - 1)
    return true
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
              <span class="flex items-center gap-1.5 text-xs text-faint">
                {kindLabel(item)}
                {#if item.background}
                  <span class="flex items-center gap-1" title="Свой фон пункта: включится с первым GO">
                    ·
                    <PaletteSwatch {...item.background} class="h-2 w-4 rounded-sm" />
                    {findPreset(item.background.preset).name}
                  </span>
                {/if}
              </span>
            </span>
          </button>
          <span class="setlist-row-tools mr-1 hidden shrink-0 items-center group-hover:flex group-focus-within:flex">
            <button
              class="grid size-6 place-items-center rounded hover:bg-panel-2
                     {item.background ? 'text-accent' : 'text-faint hover:text-muted'}"
              onclick={() => toggleItemBackground(i)}
              title={item.background
                ? `Снять фон «${findPreset(item.background.preset).name}»`
                : 'Привязать текущий фон экрана к этому пункту'}
              aria-label={item.background
                ? `Снять фон с «${item.title}»`
                : `Привязать текущий фон к «${item.title}»`}
            ><Palette size={12} /></button>
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
      <span class="mr-auto pl-1">{countLabel(setlist.items.length, ['элемент', 'элемента', 'элементов'])}</span>
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

<NoteDialog bind:open={noteOpen} onsave={saveNote} />
