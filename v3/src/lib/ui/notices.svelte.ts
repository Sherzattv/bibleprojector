/**
 * UI-уведомления: тихих отказов быть не должно —
 * любая неудача операции оставляет сообщение для оператора.
 */
class UiState {
  lastNotice = $state<string | null>(null)

  notify(message: string) {
    this.lastNotice = message
  }

  clearNotice() {
    this.lastNotice = null
  }
}

export const ui = new UiState()
