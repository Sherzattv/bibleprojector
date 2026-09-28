/**
 * Текущее время, которое тикает, пока идёт отсчёт. Вызывать при
 * инициализации компонента: таймер живёт и останавливается вместе с ним.
 */
export function tickingNow(active: () => boolean, intervalMs = 250): { readonly value: number } {
  let now = $state(Date.now())
  $effect(() => {
    if (!active()) return
    now = Date.now()
    const id = setInterval(() => (now = Date.now()), intervalMs)
    return () => clearInterval(id)
  })
  return {
    get value() {
      return now
    },
  }
}
