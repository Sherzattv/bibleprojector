/**
 * Каталог живых фонов и палитр экрана проектора.
 * Чистые данные — целостность покрыта tests/backgrounds.test.ts.
 *
 * Правила каталога (выросли из рекомендаций для церковных слайдов):
 * фон тёмный и медленный, текст на нём всегда белый, поэтому у каждой
 * палитры тёмная база и приглушённые цвета — яркость даёт сам шейдер.
 */
import { SCENES } from './shaders'

export type PaletteId = 'midnight' | 'aurora' | 'amber' | 'garnet' | 'olive' | 'graphite'

export interface Palette {
  id: PaletteId
  name: string
  /** База (почти чёрная) и три цвета сцены — hex #rrggbb */
  colors: readonly [string, string, string, string]
}

export const PALETTES: readonly Palette[] = [
  { id: 'midnight', name: 'Полночь', colors: ['#04060d', '#1d3b8f', '#0f7384', '#4b3596'] },
  { id: 'aurora', name: 'Сияние', colors: ['#02070a', '#1c9470', '#2466a8', '#6e46b4'] },
  { id: 'amber', name: 'Янтарь', colors: ['#0c0604', '#8a3b12', '#c07a1e', '#5a1d2c'] },
  { id: 'garnet', name: 'Гранат', colors: ['#0a0511', '#561e86', '#9c2459', '#27358a'] },
  { id: 'olive', name: 'Сад', colors: ['#040906', '#2d5a37', '#76893a', '#1c5a55'] },
  { id: 'graphite', name: 'Графит', colors: ['#060709', '#2a323e', '#4a5566', '#6a5d49'] },
]

export type BackgroundGroup = 'calm' | 'light' | 'nature' | 'season' | 'fx' | 'own'

export const BACKGROUND_GROUPS: readonly { id: BackgroundGroup; name: string }[] = [
  { id: 'calm', name: 'Спокойные' },
  { id: 'light', name: 'Храм и свет' },
  { id: 'nature', name: 'Природа' },
  { id: 'season', name: 'Сезонные' },
  { id: 'fx', name: 'Эффектные' },
  { id: 'own', name: 'Своё' },
]

export interface BackgroundPreset {
  id: string
  name: string
  description: string
  group: BackgroundGroup
  /** Палитра, которая ставится вместе с фоном */
  palette: PaletteId
  /**
   * none — чёрный экран без рендера (нулевая нагрузка, прежнее поведение);
   * shader — фрагментный шейдер из shaders.ts; particles — поток частиц на Canvas 2D;
   * media — своё фото или видео оператора (media.ts)
   */
  kind: 'none' | 'shader' | 'particles' | 'media'
}

export const BACKGROUNDS: readonly BackgroundPreset[] = [
  {
    id: 'black',
    name: 'Чёрный',
    description: 'Без фона, как раньше',
    group: 'calm',
    palette: 'graphite',
    kind: 'none',
  },
  {
    id: 'mesh',
    name: 'Mesh-градиент',
    description: 'Плавно дрейфующие цветовые пятна',
    group: 'calm',
    palette: 'midnight',
    kind: 'shader',
  },
  {
    id: 'fog',
    name: 'Туман',
    description: 'Тёмная дымка с мягкой глубиной',
    group: 'calm',
    palette: 'midnight',
    kind: 'shader',
  },
  {
    id: 'silk',
    name: 'Шёлк',
    description: 'Светящиеся ленты мягких волн',
    group: 'calm',
    palette: 'garnet',
    kind: 'shader',
  },
  {
    id: 'stars',
    name: 'Звёзды',
    description: 'Тихое мерцание и туманность',
    group: 'calm',
    palette: 'midnight',
    kind: 'shader',
  },
  {
    id: 'aurora',
    name: 'Сияние',
    description: 'Занавеси северного сияния',
    group: 'calm',
    palette: 'aurora',
    kind: 'shader',
  },
  {
    id: 'glass',
    name: 'Витраж',
    description: 'Цветное стекло, светящееся изнутри',
    group: 'light',
    palette: 'garnet',
    kind: 'shader',
  },
  {
    id: 'candles',
    name: 'Свечи',
    description: 'Тёплые огоньки внизу, для молитвы',
    group: 'light',
    palette: 'amber',
    kind: 'shader',
  },
  {
    id: 'rays',
    name: 'Лучи',
    description: 'Свет сверху и пыль в лучах',
    group: 'light',
    palette: 'amber',
    kind: 'shader',
  },
  {
    id: 'caustics',
    name: 'Каустика',
    description: 'Блики света на воде',
    group: 'light',
    palette: 'aurora',
    kind: 'shader',
  },
  {
    id: 'bokeh',
    name: 'Боке',
    description: 'Размытые огни плывут вверх',
    group: 'light',
    palette: 'amber',
    kind: 'shader',
  },
  {
    id: 'sky',
    name: 'Небо',
    description: 'Рассвет и медленные облака',
    group: 'nature',
    palette: 'amber',
    kind: 'shader',
  },
  {
    id: 'mountains',
    name: 'Горы',
    description: 'Слои гор в тумане',
    group: 'nature',
    palette: 'garnet',
    kind: 'shader',
  },
  {
    id: 'snow',
    name: 'Снег',
    description: 'К Рождеству',
    group: 'season',
    palette: 'midnight',
    kind: 'shader',
  },
  {
    id: 'leaves',
    name: 'Листопад',
    description: 'Осенние листья кружатся',
    group: 'season',
    palette: 'amber',
    kind: 'shader',
  },
  {
    id: 'leaks',
    name: 'Засветки',
    description: 'Тёплые кинопятна и зерно плёнки',
    group: 'fx',
    palette: 'amber',
    kind: 'shader',
  },
  {
    id: 'flow',
    name: 'Поток частиц',
    description: 'Тысячи точек текут, как дым',
    group: 'fx',
    palette: 'aurora',
    kind: 'particles',
  },
  {
    id: 'media',
    name: 'Своё фото/видео',
    description: 'Ваш файл; фото медленно наезжает',
    group: 'own',
    palette: 'graphite',
    kind: 'media',
  },
]

export function findPreset(id: string): BackgroundPreset {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0]
}

export function findPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]
}

/** GLSL-сцена фона; у none и particles её нет */
export function sceneSource(id: string): string | null {
  return SCENES[id] ?? null
}
