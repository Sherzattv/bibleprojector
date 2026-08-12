/**
 * Ширины боковых панелей: границы, перетаскивание, шаг с клавиатуры.
 * Чистые функции — покрыты tests/panel-size.test.ts.
 *
 * Главное правило: центр важнее панелей. Панель нельзя растянуть так,
 * чтобы превью, эфир и док остались без места, — поэтому верхняя граница
 * считается от реальной ширины окна и ширины соседней панели, а не только
 * от константы PANEL_MAX.
 */

/** Уже — и в списке песен остаются одни обрезанные названия */
export const PANEL_MIN = 200
/** Шире — панель начинает соперничать с эфиром без всякой пользы */
export const PANEL_MAX = 520
/** Ниже этого центр перестаёт вмещать док в одну строку */
export const STAGE_MIN = 620

export const DEFAULT_LIBRARY_WIDTH = 284
export const DEFAULT_SETLIST_WIDTH = 264

/** Сторона, к которой прижата панель: с неё же и тянут её границу */
export type PanelEdge = 'left' | 'right'

export interface ClampContext {
  /** Ширина всей рабочей области */
  total: number
  /** Сколько уже занято соседней панелью и самими разделителями */
  taken: number
  min?: number
  max?: number
  stageMin?: number
}

export function clampPanelWidth(desired: number, ctx: ClampContext): number {
  const min = ctx.min ?? PANEL_MIN
  const max = ctx.max ?? PANEL_MAX
  const stageMin = ctx.stageMin ?? STAGE_MIN
  // На узком окне свободного места может не остаться вовсе — тогда честнее
  // упереться в min, чем вернуть отрицательную ширину
  const room = Math.max(min, ctx.total - ctx.taken - stageMin)
  const upper = Math.min(max, room)
  return Math.round(Math.min(Math.max(desired, min), Math.max(min, upper)))
}

export interface FitContext {
  /** Ширина всей рабочей области */
  total: number
  /** Постоянно занятое: разделители и свёрнутые колонки */
  reserved: number
  stageMin?: number
  min?: number
}

/**
 * Ужимает панели под новое окно — пульт переехал с внешнего монитора на
 * ноутбук. Обе панели сжимаются пропорционально текущим ширинам, а не по
 * очереди: иначе первая по списку упирается в минимум, пока вторая стоит
 * нетронутой, и раскладка выглядит перекошенной.
 *
 * Если даже минимумы не влезают — оставляем минимумы: жертвовать центром
 * дальше некуда, зато панели остаются пригодными.
 */
export function fitPanels(widths: number[], ctx: FitContext): number[] {
  const min = ctx.min ?? PANEL_MIN
  const stageMin = ctx.stageMin ?? STAGE_MIN
  const budget = ctx.total - ctx.reserved - stageMin
  const sum = widths.reduce((acc, w) => acc + w, 0)
  if (sum <= budget) return widths.map((w) => Math.round(w))
  const scale = budget / sum
  return widths.map((w) => Math.max(min, Math.round(w * scale)))
}

/**
 * Куда ведёт перетаскивание: у левой панели ширина растёт вправо,
 * у правой — влево. Знак делаем здесь, чтобы компонент не гадал.
 */
export function widthFromDrag(startWidth: number, dx: number, edge: PanelEdge): number {
  return startWidth + (edge === 'left' ? dx : -dx)
}

/**
 * Шаг с клавиатуры для разделителя. Стрелки «наружу» расширяют панель,
 * «внутрь» — сужают, независимо от того, слева она или справа.
 * Возвращает дельту ширины или null, если клавиша не наша.
 */
export function keyboardDelta(key: string, edge: PanelEdge, coarse = false): number | null {
  const step = coarse ? 48 : 16
  if (key === 'ArrowRight') return edge === 'left' ? step : -step
  if (key === 'ArrowLeft') return edge === 'left' ? -step : step
  return null
}
