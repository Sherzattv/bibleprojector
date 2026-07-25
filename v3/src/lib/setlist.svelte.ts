/**
 * Порядок служения. Пока в памяти с демо-наполнением;
 * персистентность (localStorage/IndexedDB) — следующий срез.
 */
import { data } from './db.svelte'
import { show } from './show.svelte'

export type SetlistEntry =
  | { kind: 'song'; num: string; title: string }
  | { kind: 'bible'; code: string; chapter: number; verse: number; title: string }
  | { kind: 'note'; title: string; text: string }

class SetlistState {
  items = $state<SetlistEntry[]>([
    { kind: 'song', num: '214', title: 'Как лань желает' },
    { kind: 'bible', code: 'PSA', chapter: 41, verse: 2, title: 'Псалом 41:2' },
    { kind: 'song', num: '579', title: '1000 рук' },
    { kind: 'bible', code: 'JHN', chapter: 3, verse: 16, title: 'Иоанна 3:16' },
    { kind: 'note', title: 'Объявления', text: 'Молодёжная встреча — суббота, 18:00' },
  ])
  currentIdx = $state(-1)

  open(i: number) {
    const item = this.items[i]
    if (!item) return
    if (item.kind === 'song') {
      const song =
        data.songs.find((s) => s.songNumber === item.num) ??
        data.songs.find((s) => s.title.toLowerCase() === item.title.toLowerCase())
      if (song) {
        show.loadSong(song)
        this.currentIdx = i
      }
    } else if (item.kind === 'bible') {
      if (show.loadChapter(item.code, item.chapter, item.verse)) this.currentIdx = i
    }
    // note: показ заметок — следующий срез
  }
}

export const setlist = new SetlistState()
