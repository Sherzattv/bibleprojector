/**
 * Роль окна: пульт или экран проектора.
 *
 * Раньше роль вычислялась один раз в main.ts по хэшу. Теперь она может
 * меняться на лету: окно, в котором оператор нажал «Вывести на проектор»,
 * само становится экраном. Перезагрузка тут недопустима — полноэкранный
 * режим включается по тому же клику и любой переход его снимет.
 */
class WindowMode {
  // Модуль грузится и там, где никакого окна нет (тесты, SSR-подобные среды),
  // поэтому обращение к window всегда под проверкой
  isDisplay = $state(typeof window !== 'undefined' && window.location.hash === '#display')

  /**
   * Это окно теперь экран проектора. Хэш правим следом, чтобы перезагрузка
   * или восстановление вкладки подняли окно в той же роли.
   */
  becomeDisplay() {
    if (this.isDisplay) return
    this.isDisplay = true
    if (typeof window === 'undefined') return
    if (window.location.hash !== '#display') {
      window.history.replaceState(null, '', `${window.location.pathname}#display`)
    }
  }
}

export const mode = new WindowMode()
