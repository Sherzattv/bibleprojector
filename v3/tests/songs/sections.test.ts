import { describe, it, expect } from 'vitest'
import { songBaseReference, splitSongSections } from '../../src/lib/songs/sections'

describe('splitSongSections — слайды песни', () => {
  it('метки [..] начинают секции, сама метка в текст не попадает', () => {
    expect(splitSongSections('[Куплет 1]\nСтрока 1\nСтрока 2\n\n[Припев]\nПой')).toEqual([
      { label: 'Куплет 1', text: 'Строка 1\nСтрока 2' },
      { label: 'Припев', text: 'Пой' },
    ])
  })

  it('без меток — строфы по пустым строкам', () => {
    expect(splitSongSections('а\nб\n\n\nв')).toEqual([
      { label: '', text: 'а\nб' },
      { label: '', text: 'в' },
    ])
  })

  it('текст до первой метки — отдельная секция без метки', () => {
    expect(splitSongSections('вступление\n[A]\nx')).toEqual([
      { label: '', text: 'вступление' },
      { label: 'A', text: 'x' },
    ])
  })

  it('метка без текста остаётся пустым слайдом', () => {
    expect(splitSongSections('[A]\n[B]\nx')).toEqual([
      { label: 'A', text: '' },
      { label: 'B', text: 'x' },
    ])
  })

  it('метка не на отдельной строке — обычный текст, не теряется', () => {
    expect(splitSongSections('[x2] Аллилуйя')).toEqual([{ label: '', text: '[x2] Аллилуйя' }])
  })

  it('пустой текст — нет секций', () => {
    expect(splitSongSections('')).toEqual([])
    expect(splitSongSections('  \n ')).toEqual([])
    expect(splitSongSections(undefined)).toEqual([])
  })
})

describe('songBaseReference', () => {
  it('название и номер', () => {
    expect(songBaseReference({ title: 'Благодать', songNumber: '310' })).toBe('Благодать · № 310')
  })

  it('без номера — только название', () => {
    expect(songBaseReference({ title: 'Тихая песня' })).toBe('Тихая песня')
  })
})
