/**
 * Состояние «шоу»: что в превью, что в эфире.
 * Svelte 5 runes; в реальном приложении сюда же подключится
 * BroadcastChannel для окна проектора.
 */
import { demoSong, type Song } from './data'

class ShowState {
  song: Song = $state(demoSong)
  previewIdx = $state(2)
  liveIdx = $state(1)
  blackout = $state(false)
  cleared = $state(false)

  get previewSlide() {
    return this.song.slides[this.previewIdx]
  }
  get liveSlide() {
    return this.song.slides[this.liveIdx]
  }

  setPreview(i: number) {
    if (i >= 0 && i < this.song.slides.length) this.previewIdx = i
  }

  next() {
    this.setPreview(this.previewIdx + 1)
  }

  prev() {
    this.setPreview(this.previewIdx - 1)
  }

  /** Превью → эфир, превью сдвигается на следующий слайд */
  go() {
    this.liveIdx = this.previewIdx
    this.cleared = false
    if (this.previewIdx < this.song.slides.length - 1) this.previewIdx++
  }

  /** Слайд сразу в эфир (двойной клик) */
  takeLive(i: number) {
    this.previewIdx = i
    this.go()
  }

  toggleBlackout() {
    this.blackout = !this.blackout
  }

  clear() {
    this.cleared = true
  }
}

export const show = new ShowState()
