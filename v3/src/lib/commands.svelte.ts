/**
 * Слой команд — единая точка входа для UI.
 * Все мутации шоу/данных идут отсюда: здесь пишется история,
 * отсюда же состояние уходит на экран проектора.
 */
import { data } from './db.svelte'
import { show } from './show.svelte'
import { ui } from './ui.svelte'
import { history } from './history.svelte'
import { projSettings } from './proj-settings.svelte'
import { serviceScreen } from './service-screen.svelte'

export const commands = {
  openSong(id: number): boolean {
    const song = data.songsById.get(id)
    if (!song) {
      ui.notify(`Песня (id ${id}) не найдена в каталоге`)
      return false
    }
    show.loadSong(song)
    return true
  },

  openRef(code: string, chapter: number, verse = 1): boolean {
    if (!show.loadChapter(code, chapter, verse)) {
      ui.notify(`Глава ${code} ${chapter} не найдена в переводе ${data.translation}`)
      return false
    }
    return true
  },

  openNote(title: string, text: string): void {
    show.loadNote(title, text)
  },

  go(): void {
    if (!show.slides.length) return
    // GO во время отсчёта или заставки — оператор начинает служение:
    // служебный экран уходит, в эфир идёт превью (а не следующая строка)
    if (serviceScreen.mode !== 'off') serviceScreen.hide()
    // Подсветка строк в песне: GO сначала идёт по строкам живого слайда
    else if (projSettings.lineHighlight && show.stepLine()) return
    // Пункт порядка служения со своим фоном: включаем вместе с первым слайдом
    if (show.itemBackground) {
      projSettings.setBackground(show.itemBackground)
      show.itemBackground = null
    }
    show.go()
    const live = show.liveSlide
    const source = show.source
    if (!live || !source) return
    if (source.kind === 'bible') {
      history.push({
        title: show.title,
        reference: live.reference,
        source: { ...source, verse: live.verse ?? 0 },
      })
    } else if (source.kind === 'song') {
      history.push({ title: show.title, reference: show.baseReference, source })
    } else {
      history.push({ title: source.title, reference: source.title, source })
    }
  },

  next(): void {
    show.next()
  },

  prev(): void {
    show.prev()
  },

  toggleBlackout(): void {
    show.toggleBlackout()
  },

  clearLive(): void {
    show.clear()
    serviceScreen.hide()
  },

  /** Второй перевод на экране; null — выключить */
  setSecondaryTranslation(code: string | null): void {
    projSettings.setParallel({ secondaryTranslation: code })
    show.secondaryCode = projSettings.secondaryTranslation
    show.refreshSecondary()
  },

  setTranslation(code: string): boolean {
    if (!data.bibles[code]) {
      ui.notify(`Перевод ${code} ещё не загружен`)
      return false
    }
    data.translation = code
    show.reloadForTranslation()
    return true
  },
}
