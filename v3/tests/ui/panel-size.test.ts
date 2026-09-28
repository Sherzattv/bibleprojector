import { describe, it, expect } from 'vitest'
import {
  clampPanelWidth,
  fitPanels,
  keyboardDelta,
  widthFromDrag,
  PANEL_MAX,
  PANEL_MIN,
  STAGE_MIN,
} from '../src/lib/panel-size'

describe('clampPanelWidth — панель не должна съесть центр', () => {
  const wide = { total: 1920, taken: 276 }

  it('обычное значение проходит как есть', () => {
    expect(clampPanelWidth(320, wide)).toBe(320)
  })

  it('уже минимума не пускаем', () => {
    expect(clampPanelWidth(40, wide)).toBe(PANEL_MIN)
  })

  it('шире максимума не пускаем даже на большом экране', () => {
    expect(clampPanelWidth(900, { total: 3000, taken: 276 })).toBe(PANEL_MAX)
  })

  it('на узком окне граница считается от места, а не от константы', () => {
    // 1280 − 276 занято − 620 центру = 384 остаётся панели
    expect(clampPanelWidth(500, { total: 1280, taken: 276 })).toBe(1280 - 276 - STAGE_MIN)
  })

  it('когда места нет вовсе, откатываемся к минимуму, а не к отрицательной ширине', () => {
    expect(clampPanelWidth(300, { total: 700, taken: 276 })).toBe(PANEL_MIN)
  })

  it('дробные значения от мыши округляются', () => {
    expect(clampPanelWidth(300.6, wide)).toBe(301)
  })
})

describe('fitPanels — пульт переехал на экран поменьше', () => {
  it('всё влезает — ширины не трогаем', () => {
    expect(fitPanels([284, 264], { total: 1920, reserved: 12 })).toEqual([284, 264])
  })

  it('обе панели ужимаются пропорционально, а не по очереди', () => {
    // 1280 − 12 разделителей − 620 центру = 648 на две панели
    const [library, setlist] = fitPanels([520, 520], { total: 1280, reserved: 12 })
    expect(library).toBe(324)
    expect(setlist).toBe(324)
    expect(library + setlist).toBeLessThanOrEqual(1280 - 12 - STAGE_MIN)
  })

  it('пропорция сохраняется: широкая панель остаётся шире', () => {
    const [library, setlist] = fitPanels([480, 240], { total: 1280, reserved: 12 })
    expect(library).toBeGreaterThan(setlist)
    expect(library + setlist).toBeLessThanOrEqual(1280 - 12 - STAGE_MIN)
  })

  it('ниже минимума не ужимаем даже ценой центра', () => {
    expect(fitPanels([300, 300], { total: 800, reserved: 12 })).toEqual([PANEL_MIN, PANEL_MIN])
  })

  it('свёрнутый план учитывается через reserved', () => {
    expect(fitPanels([520], { total: 1280, reserved: 12 + 44 })).toEqual([520])
  })
})

describe('widthFromDrag — знак зависит от стороны', () => {
  it('левую панель тянут вправо — она шире', () => {
    expect(widthFromDrag(280, 40, 'left')).toBe(320)
  })

  it('правую панель тянут вправо — она уже', () => {
    expect(widthFromDrag(280, 40, 'right')).toBe(240)
  })

  it('обратное движение возвращает к исходной ширине', () => {
    expect(widthFromDrag(280, -40, 'right')).toBe(320)
  })
})

describe('keyboardDelta — стрелки на разделителе', () => {
  it('«наружу» расширяет панель с любой стороны', () => {
    expect(keyboardDelta('ArrowRight', 'left')).toBe(16)
    expect(keyboardDelta('ArrowLeft', 'right')).toBe(16)
  })

  it('«внутрь» сужает', () => {
    expect(keyboardDelta('ArrowLeft', 'left')).toBe(-16)
    expect(keyboardDelta('ArrowRight', 'right')).toBe(-16)
  })

  it('с Shift шаг крупный', () => {
    expect(keyboardDelta('ArrowRight', 'left', true)).toBe(48)
  })

  it('прочие клавиши разделитель не трогают', () => {
    expect(keyboardDelta('Enter', 'left')).toBeNull()
    expect(keyboardDelta('ArrowUp', 'right')).toBeNull()
  })
})
