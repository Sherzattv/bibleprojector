// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { dismissable } from '../src/lib/dismiss'

describe('dismissable: панель закрывается кликом мимо и Esc', () => {
  let wrap: HTMLDivElement
  let inside: HTMLButtonElement
  let outside: HTMLButtonElement
  let closed: number

  beforeEach(() => {
    document.body.innerHTML = ''
    wrap = document.createElement('div')
    inside = document.createElement('button')
    outside = document.createElement('button')
    wrap.appendChild(inside)
    document.body.append(wrap, outside)
    closed = 0
  })

  const pointer = (el: Element) =>
    el.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))

  it('клик мимо закрывает, клик внутри — нет', () => {
    const a = dismissable(wrap, { open: true, close: () => closed++ })
    pointer(inside)
    expect(closed).toBe(0)
    pointer(outside)
    expect(closed).toBe(1)
    a.destroy()
  })

  it('закрытая панель на клики не реагирует', () => {
    const a = dismissable(wrap, { open: false, close: () => closed++ })
    pointer(outside)
    expect(closed).toBe(0)
    a.update({ open: true, close: () => closed++ })
    pointer(outside)
    expect(closed).toBe(1)
    a.destroy()
  })

  it('Esc закрывает и не доходит до хоткеев пульта (там Esc гасит эфир)', () => {
    const a = dismissable(wrap, { open: true, close: () => closed++ })
    let reachedWindow = false
    const onWin = () => (reachedWindow = true)
    window.addEventListener('keydown', onWin)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(closed).toBe(1)
    expect(reachedWindow).toBe(false)
    window.removeEventListener('keydown', onWin)
    a.destroy()
  })

  it('с закрытой панелью Esc проходит к хоткеям как обычно', () => {
    const a = dismissable(wrap, { open: false, close: () => closed++ })
    let reachedWindow = false
    const onWin = () => (reachedWindow = true)
    window.addEventListener('keydown', onWin)
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(reachedWindow).toBe(true)
    window.removeEventListener('keydown', onWin)
    a.destroy()
  })

  it('после destroy слушатели сняты', () => {
    const a = dismissable(wrap, { open: true, close: () => closed++ })
    a.destroy()
    pointer(outside)
    expect(closed).toBe(0)
  })
})
