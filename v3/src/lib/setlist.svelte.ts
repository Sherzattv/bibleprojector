/**
 * Порядок служения. Пока в памяти с демо-наполнением;
 * персистентность (localStorage/IndexedDB) — следующий срез.
 *
 * Песни адресуются по song.id: номера песен в каталоге НЕ уникальны
 * (3013 задвоенных номеров на 11524 песни).
 */
import { commands } from './commands.svelte'
import { ui } from './ui.svelte'

export type SetlistEntry =
  | { kind: 'song'; id: number; title: string }
  | { kind: 'bible'; code: string; chapter: number; verse: number; title: string }
  | { kind: 'note'; title: string; text: string }

class SetlistState {
  items = $state<SetlistEntry[]>([
    { kind: 'song', id: 135, title: 'Как лань желает' },
    { kind: 'bible', code: 'PSA', chapter: 41, verse: 2, title: 'Псалом 41:2' },
    { kind: 'song', id: 9324, title: '1000 рук' },
    { kind: 'bible', code: 'JHN', chapter: 3, verse: 16, title: 'Иоанна 3:16' },
    { kind: 'note', title: 'Объявления', text: 'Молодёжная встреча — суббота, 18:00' },
  ])
  currentIdx = $state(-1)

  open(i: number) {
    const item = this.items[i]
    if (!item) return
    if (item.kind === 'song') {
      if (!commands.openSong(item.id)) return
    } else if (item.kind === 'bible') {
      if (!commands.openRef(item.code, item.chapter, item.verse)) return
    } else {
      commands.openNote(item.title, item.text)
    }
    this.currentIdx = i
    ui.clearNotice()
  }
}

export const setlist = new SetlistState()
