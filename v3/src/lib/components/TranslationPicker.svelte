<script lang="ts">
  import { ChevronDown, Check } from '@lucide/svelte'
  import { data, TRANSLATIONS } from '../db.svelte'
  import { commands } from '../commands.svelte'
  import { nextIndex } from '../omni-list'
  import { buildTranslationOptions, initialActive, statusNote } from '../translation-picker'

  let open = $state(false)
  let active = $state(-1)
  let root = $state<HTMLDivElement>()
  let trigger = $state<HTMLButtonElement>()

  const options = $derived(
    buildTranslationOptions(TRANSLATIONS, data.bibles, data.translationStatus),
  )
  const current = $derived(options.find((o) => o.code === data.translation))

  function openList() {
    open = true
    active = initialActive(options, data.translation)
  }

  function close(returnFocus = false) {
    open = false
    active = -1
    if (returnFocus) trigger?.focus()
  }

  function pick(code: string) {
    // Отказ (перевод не загружен) уже объяснён уведомлением — список не
    // закрываем, чтобы оператор видел, из чего ещё можно выбрать
    if (!commands.setTranslation(code)) return
    close(true)
  }

  function onKeydown(e: KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openList()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      active = nextIndex(options.length, active, e.key === 'ArrowDown' ? 1 : -1)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (active >= 0) pick(options[active].code)
      return
    }
    // Уход по Tab не должен оставлять висящий список
    if (e.key === 'Tab') close()
  }

  // Клик мимо закрывает список. mousedown, а не click: иначе первый клик по
  // соседней кнопке только закрывал бы список, не нажимая саму кнопку.
  $effect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root?.contains(e.target as Node)) close()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  })
</script>

<div class="relative" bind:this={root}>
  <button
    bind:this={trigger}
    onclick={() => (open ? close() : openList())}
    onkeydown={onKeydown}
    class="flex h-7 items-center gap-1 rounded border border-stroke-2 bg-panel-2 pr-1.5 pl-2 text-sm
           font-medium text-muted hover:bg-hover hover:text-ink {open
      ? 'border-accent text-ink'
      : ''}"
    aria-label="Перевод: {current ? `${current.code} · ${current.label}` : data.translation}"
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls="translation-listbox"
    aria-activedescendant={open && active >= 0 ? `translation-opt-${active}` : undefined}
    title="Перевод — {current?.label ?? data.translation}"
  >
    {data.translation}
    <ChevronDown size={13} />
  </button>

  {#if open}
    <!-- Док прижат к низу окна: список раскрывается вверх -->
    <div
      id="translation-listbox"
      role="listbox"
      aria-label="Перевод"
      class="absolute right-0 bottom-9 z-50 w-72 rounded-md border border-stroke-2 bg-panel-2 p-1.5
             shadow-xl shadow-black/50"
    >
      {#each options as option, i (option.code)}
        <button
          id="translation-opt-{i}"
          role="option"
          aria-selected={option.code === data.translation}
          tabindex="-1"
          disabled={option.disabled}
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-muted
                 hover:bg-hover hover:text-ink disabled:pointer-events-none disabled:opacity-40
                 {active === i ? 'bg-hover text-ink' : ''}"
          onpointerdown={(e) => {
            e.preventDefault()
            pick(option.code)
          }}
        >
          <span class="w-3.5 shrink-0 text-accent">
            {#if option.code === data.translation}<Check size={13} />{/if}
          </span>
          <span class="font-medium">{option.code}</span>
          <span class="min-w-0 flex-1 truncate text-faint">{option.label}</span>
          {#if statusNote(option.status)}
            <span class="shrink-0 text-2xs text-faint">{statusNote(option.status)}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
