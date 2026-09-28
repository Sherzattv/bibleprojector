/**
 * Модель выбора перевода: что показать в списке и что можно выбрать.
 * Чистые функции — покрыты tests/translation-picker.test.ts.
 *
 * Зачем отдельный список вместо нативного <select>: в закрытом виде он
 * показывал «RST · Синодальный» и занимал 162px. Вместе со словом «Перевод»
 * доку нужно было 911px, а центральной зоне на 1280 с открытым порядком
 * служения достаётся 730px — селект уезжал за край. Теперь в доке только
 * код (~62px), а полные имена живут в раскрытом списке, где место есть.
 */
import type { LoadStatus } from './db.svelte'

export interface TranslationOption {
  code: string
  /** Полное имя для списка: «Синодальный» */
  label: string
  status?: LoadStatus
  /** Ещё не загружен — выбрать нельзя */
  disabled: boolean
}

export function buildTranslationOptions(
  translations: Array<[code: string, label: string]>,
  loaded: Record<string, unknown>,
  status: Record<string, LoadStatus>,
): TranslationOption[] {
  return translations.map(([code, label]) => ({
    code,
    label,
    status: status[code],
    disabled: !loaded[code],
  }))
}

/** Пояснение справа в строке списка; пустое — значит перевод готов */
export function statusNote(status?: LoadStatus): string {
  if (status === 'loading') return 'загрузка…'
  if (status === 'error') return 'ошибка'
  return ''
}

/**
 * Позиция, с которой открывается список. Ведём от текущего перевода, а не
 * от нуля: стрелка вниз должна двигать от того, что оператор уже видит.
 */
export function initialActive(options: TranslationOption[], current: string): number {
  const idx = options.findIndex((o) => o.code === current)
  return idx >= 0 ? idx : -1
}
