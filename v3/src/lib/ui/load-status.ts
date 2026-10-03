/**
 * Подписи статуса загрузки для переключателей переводов и языков песен.
 * Чистые функции — покрыты tests/ui/load-status.test.ts.
 */
import type { LoadStatus } from '../data/db.svelte'

/** Пояснение справа в строке списка; пустое — значит база готова */
export function statusNote(status?: LoadStatus): string {
  if (status === 'loading') return 'загрузка…'
  if (status === 'error') return 'ошибка'
  return ''
}

/** Подсказка с пояснением статуса: «KTB · Қазақша — загрузка…» */
export function withStatusNote(title: string, status?: LoadStatus): string {
  const note = statusNote(status)
  return note ? `${title} — ${note}` : title
}
