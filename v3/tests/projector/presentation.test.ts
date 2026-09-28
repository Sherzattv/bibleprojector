import { describe, it, expect, vi } from 'vitest'
import { receiveJson } from '../../src/lib/projector/presentation'

describe('receiveJson — сообщения PresentationConnection', () => {
  it('JSON-строка доставляется разобранной', () => {
    const deliver = vi.fn()
    receiveJson(deliver)({ data: '{"type":"ping"}' })
    expect(deliver).toHaveBeenCalledWith({ type: 'ping' })
  })

  it('битая строка и не-строка молча отбрасываются', () => {
    const deliver = vi.fn()
    const onMessage = receiveJson(deliver)
    expect(() => onMessage({ data: '{битое' })).not.toThrow()
    onMessage({ data: new ArrayBuffer(4) })
    expect(deliver).not.toHaveBeenCalled()
  })
})
