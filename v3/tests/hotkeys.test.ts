// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
// Модуль ещё не существует — тест красный до реализации (TDD)
import { isInteractiveTarget, resolveHotkey } from '../src/lib/hotkeys'

/** Элемент нужного тега через настоящий DOM (jsdom) */
function el(tag: string): Element {
  return document.createElement(tag)
}

/** Элемент с contenteditable */
function editable(): Element {
  const div = document.createElement('div')
  div.setAttribute('contenteditable', 'true')
  return div
}

describe('isInteractiveTarget — где хоткеи не должны срабатывать', () => {
  it('true для INPUT, TEXTAREA, SELECT, BUTTON', () => {
    expect(isInteractiveTarget(el('input'))).toBe(true)
    expect(isInteractiveTarget(el('textarea'))).toBe(true)
    expect(isInteractiveTarget(el('select'))).toBe(true)
    expect(isInteractiveTarget(el('button'))).toBe(true)
  })

  it('true для contenteditable', () => {
    expect(isInteractiveTarget(editable())).toBe(true)
  })

  it('true для вложенного span внутри button (closest)', () => {
    const button = document.createElement('button')
    const span = document.createElement('span')
    button.appendChild(span)
    expect(isInteractiveTarget(span)).toBe(true)
  })

  it('true для span внутри contenteditable-контейнера', () => {
    const box = editable()
    const span = document.createElement('span')
    box.appendChild(span)
    expect(isInteractiveTarget(span)).toBe(true)
  })

  it('false для body, div и null', () => {
    expect(isInteractiveTarget(document.body)).toBe(false)
    expect(isInteractiveTarget(el('div'))).toBe(false)
    expect(isInteractiveTarget(null)).toBe(false)
  })
})

describe('resolveHotkey — глобальные хоткеи', () => {
  const body = () => document.body

  it('Space на body → go', () => {
    expect(resolveHotkey({ code: 'Space', key: ' ', target: body() })).toBe('go')
  })

  it('Space при фокусе на SELECT → null (не запускать эфир из выпадашки)', () => {
    expect(resolveHotkey({ code: 'Space', key: ' ', target: el('select') })).toBeNull()
  })

  it('Space на BUTTON → null (Space «нажимает» кнопку)', () => {
    expect(resolveHotkey({ code: 'Space', key: ' ', target: el('button') })).toBeNull()
  })

  it('стрелки на body → next/prev', () => {
    expect(resolveHotkey({ key: 'ArrowRight', target: body() })).toBe('next')
    expect(resolveHotkey({ key: 'ArrowDown', target: body() })).toBe('next')
    expect(resolveHotkey({ key: 'ArrowLeft', target: body() })).toBe('prev')
    expect(resolveHotkey({ key: 'ArrowUp', target: body() })).toBe('prev')
  })

  it('стрелка на SELECT → null (стрелки листают опции)', () => {
    expect(resolveHotkey({ key: 'ArrowDown', target: el('select') })).toBeNull()
  })

  it('стрелка из INPUT → null (курсор в тексте)', () => {
    expect(resolveHotkey({ key: 'ArrowLeft', target: el('input') })).toBeNull()
  })

  it('«b» и русская «и» на body → blackout, в любом регистре', () => {
    expect(resolveHotkey({ key: 'b', target: body() })).toBe('blackout')
    expect(resolveHotkey({ key: 'B', target: body() })).toBe('blackout')
    expect(resolveHotkey({ key: 'и', target: body() })).toBe('blackout')
  })

  it('«И» (заглавная русская) на body → blackout', () => {
    expect(resolveHotkey({ key: 'И', target: body() })).toBe('blackout')
  })

  it('«b» из TEXTAREA → null (пользователь печатает)', () => {
    expect(resolveHotkey({ key: 'b', target: el('textarea') })).toBeNull()
  })

  it('Escape на body → clear', () => {
    expect(resolveHotkey({ key: 'Escape', target: body() })).toBe('clear')
  })

  it('Ctrl+K → focus-search даже из INPUT', () => {
    expect(resolveHotkey({ key: 'k', ctrlKey: true, target: el('input') })).toBe('focus-search')
  })

  it('Cmd+K на body → focus-search', () => {
    expect(resolveHotkey({ key: 'k', metaKey: true, target: body() })).toBe('focus-search')
  })

  it('Ctrl+K в верхнем регистре («K») → focus-search', () => {
    expect(resolveHotkey({ key: 'K', ctrlKey: true, target: el('textarea') })).toBe('focus-search')
  })

  it('«k» без модификаторов — не хоткей', () => {
    expect(resolveHotkey({ key: 'k', target: body() })).toBeNull()
  })

  it('незнакомая клавиша → null', () => {
    expect(resolveHotkey({ key: 'x', target: body() })).toBeNull()
  })
})
