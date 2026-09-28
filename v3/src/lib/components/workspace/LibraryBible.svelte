<script lang="ts">
  import { ChevronLeft } from '@lucide/svelte'
  import { BOOKS, bookTitleIn } from '../../bible/books'
  import { findBook } from '../../bible/chapters'
  import { data } from '../../data/db.svelte'
  import { commands } from '../../show/commands.svelte'
  import { libraryRow as row } from './library-row'

  /** Книги текущего перевода и сетка глав выбранной книги */
  interface Props {
    /** Выбранная книга живёт в Library — переживает переключение вкладок */
    selected: string | null
  }
  let { selected: selectedBook = $bindable() }: Props = $props()

  /** Книги, реально существующие в текущем переводе */
  const books = $derived.by(() => {
    const db = data.db
    if (!db) return []
    const translation = data.translation
    return BOOKS.flatMap(({ code }) => {
      const book = findBook(db, code, translation)
      return book
        ? [{ code, title: bookTitleIn(code, translation), chapters: book.Chapters.length }]
        : []
    })
  })

  const selectedBookInfo = $derived(books.find((b) => b.code === selectedBook) ?? null)

  function openChapter(code: string, chapter: number) {
    commands.openRef(code, chapter)
  }
</script>

{#if selectedBookInfo}
  <button
    class="flex h-8 shrink-0 items-center gap-1.5 border-b border-stroke px-3 text-sm font-medium text-accent hover:bg-hover"
    onclick={() => (selectedBook = null)}
  >
    <ChevronLeft size={13} />{selectedBookInfo.title}
  </button>
  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    <div class="grid grid-cols-6 gap-1">
      {#each Array.from({ length: selectedBookInfo.chapters }, (_, n) => n + 1) as n (n)}
        <button
          class="grid h-8 place-items-center rounded border border-stroke-2 font-mono text-sm text-muted tabular-nums
                 hover:border-accent hover:text-ink"
          onclick={() => openChapter(selectedBookInfo.code, n)}
        >
          {n}
        </button>
      {/each}
    </div>
  </div>
{:else}
  <div class="min-h-0 flex-1 overflow-y-auto py-1">
    {#each books as book (book.code)}
      <button class={row} onclick={() => (selectedBook = book.code)}>
        <span class="truncate text-base">{book.title}</span>
        <span class="ml-auto shrink-0 font-mono text-xs text-faint tabular-nums">{book.chapters}</span>
      </button>
    {/each}
  </div>
  <div class="flex h-8 shrink-0 items-center border-t border-stroke px-3 text-xs text-faint">
    {books.length} книг · {data.translation}{data.demo ? ' · демо-данные' : ''}
  </div>
{/if}
