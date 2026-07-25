import type { SongRow } from '../db.svelte'

export interface SongSection {
  label: string
  rawText: string
  html: string
}

export interface SongProjection {
  type: 'song'
  id: number
  title: string
  text: string
  reference: string
  baseReference: string
  rawText: string
  sections: SongSection[]
  sectionIndex: number
  copyright: string
}

export function formatSongText(text: string): string
export function splitSongSections(text: string): SongSection[]
export function toSongProjection(song: SongRow): SongProjection
export function searchSongs(query: string, songs?: SongRow[], limit?: number): SongRow[]
export function getSongById(id: number | string, songs?: SongRow[]): SongRow | null
