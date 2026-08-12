import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ProjectorLink, DisplayReceiver, type Channel } from '../src/lib/projector-link.svelte'

interface Msg {
  type: string
  content?: unknown
  settings?: unknown
}

class FakeChannel implements Channel {
  sent: unknown[] = []
  onmessage: ((msg: unknown) => void) | null = null
  post(m: unknown) {
    this.sent.push(m)
  }
}

/** Пара каналов, соединённых вручную: post одного вызывает onmessage другого */
function linkedPair(): [FakeChannel, FakeChannel] {
  const a = new FakeChannel()
  const b = new FakeChannel()
  const origA = a.post.bind(a)
  const origB = b.post.bind(b)
  a.post = (m) => {
    origA(m)
    b.onmessage?.(m)
  }
  b.post = (m) => {
    origB(m)
    a.onmessage?.(m)
  }
  return [a, b]
}

function sentOfType(channel: FakeChannel, type: string): Msg[] {
  return (channel.sent as Msg[]).filter((m) => m.type === type)
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ProjectorLink: пинги', () => {
  it('до start ничего не постится, connected false', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    expect(link.connected).toBe(false)
    vi.advanceTimersByTime(10000)
    expect(sentOfType(channel, 'ping')).toHaveLength(0)
  })

  it('после start каждые 2000мс (по умолчанию) уходит {type:"ping"}', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()

    vi.advanceTimersByTime(2000)
    expect(sentOfType(channel, 'ping')).toHaveLength(1)

    vi.advanceTimersByTime(4000)
    expect(sentOfType(channel, 'ping')).toHaveLength(3)
    link.stop()
  })

  it('кастомный pingIntervalMs уважается', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel, { pingIntervalMs: 500, timeoutMs: 5000 })
    link.start()

    vi.advanceTimersByTime(499)
    expect(sentOfType(channel, 'ping')).toHaveLength(0)
    vi.advanceTimersByTime(1)
    expect(sentOfType(channel, 'ping')).toHaveLength(1)
    vi.advanceTimersByTime(1500)
    expect(sentOfType(channel, 'ping')).toHaveLength(4)
    link.stop()
  })

  it('stop() прекращает пинги', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    vi.advanceTimersByTime(2000)
    expect(sentOfType(channel, 'ping')).toHaveLength(1)

    link.stop()
    vi.advanceTimersByTime(20000)
    expect(sentOfType(channel, 'ping')).toHaveLength(1)
  })
})

describe('ProjectorLink: честный connected', () => {
  it('стартует false, pong делает true', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    expect(link.connected).toBe(false)

    channel.onmessage?.({ type: 'pong' })
    expect(link.connected).toBe(true)
    link.stop()
  })

  it('без pong дольше timeoutMs (по умолчанию 5000) connected падает в false', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    channel.onmessage?.({ type: 'pong' })
    expect(link.connected).toBe(true)

    // Экран «умер»: пинги уходят, ответов нет. 6000мс > 5000мс таймаута.
    vi.advanceTimersByTime(6000)
    expect(link.connected).toBe(false)
    link.stop()
  })

  it('markDisconnected гасит connected сразу, не дожидаясь таймаута', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    channel.onmessage?.({ type: 'pong', fullscreen: true })
    expect(link.connected).toBe(true)
    expect(link.displayFullscreen).toBe(true)

    // Окно закрыли из пульта: кнопки управления не должны жить ещё 5 секунд
    link.markDisconnected()
    expect(link.connected).toBe(false)
    expect(link.displayFullscreen).toBe(false)
    link.stop()
  })

  it('уцелевший экран возвращает connected ближайшим pong', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    link.markDisconnected()
    expect(link.connected).toBe(false)

    channel.onmessage?.({ type: 'pong' })
    expect(link.connected).toBe(true)
    link.stop()
  })

  it('пока pong приходят регулярно, connected держится true', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(2000)
      channel.onmessage?.({ type: 'pong' })
      expect(link.connected).toBe(true)
    }
    link.stop()
  })

  it('возобновившийся pong после потери снова даёт true', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    channel.onmessage?.({ type: 'pong' })

    vi.advanceTimersByTime(6000)
    expect(link.connected).toBe(false)

    channel.onmessage?.({ type: 'pong' })
    expect(link.connected).toBe(true)
    link.stop()
  })

  it('кастомный timeoutMs уважается', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel, { pingIntervalMs: 100, timeoutMs: 300 })
    link.start()
    channel.onmessage?.({ type: 'pong' })
    expect(link.connected).toBe(true)

    vi.advanceTimersByTime(400)
    expect(link.connected).toBe(false)
    link.stop()
  })
})

describe('ProjectorLink: sendState и hello', () => {
  it('sendState постит {type:"state", content, settings}', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    const content = { kind: 'slide', text: 'Благодать спасла меня', reference: 'Благодать · № 310' }
    const settings = { fontScale: 1.2, showReference: true }
    link.sendState(content, settings)

    const states = sentOfType(channel, 'state')
    expect(states).toHaveLength(1)
    expect(states[0]).toEqual({ type: 'state', content, settings })
  })

  it('на {type:"hello"} немедленно постит последний отправленный state', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    const content = { kind: 'slide', text: 'Пой аллилуйя', reference: 'Благодать · Припев' }
    const settings = { fontScale: 1, showReference: false }
    link.sendState(content, settings)
    expect(sentOfType(channel, 'state')).toHaveLength(1)

    // Экран открылся позже и поздоровался — ему тут же уезжает текущее состояние
    channel.onmessage?.({ type: 'hello' })
    const states = sentOfType(channel, 'state')
    expect(states).toHaveLength(2)
    expect(states[1]).toEqual({ type: 'state', content, settings })
    link.stop()
  })

  it('hello до первого sendState не постит state', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    channel.onmessage?.({ type: 'hello' })
    expect(sentOfType(channel, 'state')).toHaveLength(0)
    link.stop()
  })

  it('hello тоже означает живость: connected становится true', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    expect(link.connected).toBe(false)

    channel.onmessage?.({ type: 'hello' })
    expect(link.connected).toBe(true)
    link.stop()
  })
})

describe('ProjectorLink: состояние fullscreen и команды', () => {
  it('стартует с displayFullscreen=false', () => {
    expect(new ProjectorLink(new FakeChannel()).displayFullscreen).toBe(false)
  })

  it('признак fullscreen приезжает вместе с pong и hello', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()

    channel.onmessage?.({ type: 'pong', fullscreen: true })
    expect(link.displayFullscreen).toBe(true)

    channel.onmessage?.({ type: 'pong', fullscreen: false })
    expect(link.displayFullscreen).toBe(false)

    channel.onmessage?.({ type: 'hello', fullscreen: true })
    expect(link.displayFullscreen).toBe(true)
    link.stop()
  })

  it('потеря связи сбрасывает fullscreen: про молчащий экран мы ничего не знаем', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.start()
    channel.onmessage?.({ type: 'pong', fullscreen: true })

    vi.advanceTimersByTime(6000)
    expect(link.connected).toBe(false)
    expect(link.displayFullscreen).toBe(false)
    link.stop()
  })

  it('command постит {type:"cmd", cmd}', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    link.command('fullscreen')
    link.command('close')

    expect(sentOfType(channel, 'cmd')).toEqual([
      { type: 'cmd', cmd: 'fullscreen' },
      { type: 'cmd', cmd: 'close' },
    ])
  })

  it('onReady зовётся на hello — окно загрузилось и готово к командам', () => {
    const channel = new FakeChannel()
    const link = new ProjectorLink(channel)
    let ready = 0
    link.onReady = () => ready++

    channel.onmessage?.({ type: 'pong' })
    expect(ready).toBe(0)

    channel.onmessage?.({ type: 'hello' })
    expect(ready).toBe(1)
  })
})

describe('DisplayReceiver', () => {
  it('стартует с content {kind:"empty"} и settings null', () => {
    const channel = new FakeChannel()
    const receiver = new DisplayReceiver(channel)
    expect(receiver.content).toEqual({ kind: 'empty' })
    expect(receiver.settings).toBeNull()
  })

  it('при создании постит {type:"hello"}', () => {
    const channel = new FakeChannel()
    new DisplayReceiver(channel)
    expect(sentOfType(channel, 'hello')).toHaveLength(1)
  })

  it('входящий state обновляет content и settings', () => {
    const channel = new FakeChannel()
    const receiver = new DisplayReceiver(channel)
    const content = { kind: 'note', text: 'Объявление', title: 'Служение' }
    const settings = { fontScale: 0.9, showReference: true }
    channel.onmessage?.({ type: 'state', content, settings })

    expect(receiver.content).toEqual(content)
    expect(receiver.settings).toEqual(settings)
  })

  it('на входящий ping отвечает pong', () => {
    const channel = new FakeChannel()
    new DisplayReceiver(channel)
    expect(sentOfType(channel, 'pong')).toHaveLength(0)

    channel.onmessage?.({ type: 'ping' })
    expect(sentOfType(channel, 'pong')).toHaveLength(1)

    channel.onmessage?.({ type: 'ping' })
    expect(sentOfType(channel, 'pong')).toHaveLength(2)
  })

  it('в pong и hello уезжает текущее состояние fullscreen', () => {
    const channel = new FakeChannel()
    const receiver = new DisplayReceiver(channel)
    expect(sentOfType(channel, 'hello')[0]).toEqual({ type: 'hello', fullscreen: false })

    receiver.fullscreen = true
    channel.onmessage?.({ type: 'ping' })
    expect(sentOfType(channel, 'pong')[0]).toEqual({ type: 'pong', fullscreen: true })
  })

  it('команды пульта уходят в onCommand', () => {
    const channel = new FakeChannel()
    const receiver = new DisplayReceiver(channel)
    const got: string[] = []
    receiver.onCommand = (cmd) => got.push(cmd)

    channel.onmessage?.({ type: 'cmd', cmd: 'fullscreen' })
    channel.onmessage?.({ type: 'cmd', cmd: 'close' })
    // мусорная команда без cmd не должна доходить
    channel.onmessage?.({ type: 'cmd' })

    expect(got).toEqual(['fullscreen', 'close'])
  })

  it('команда без подписчика не бросает', () => {
    const channel = new FakeChannel()
    new DisplayReceiver(channel)
    expect(() => channel.onmessage?.({ type: 'cmd', cmd: 'close' })).not.toThrow()
  })
})

describe('интеграция: контроллер и экран через пару каналов', () => {
  it('sendState с контроллера доезжает до receiver.content', () => {
    const [ctrlChannel, dispChannel] = linkedPair()
    const link = new ProjectorLink(ctrlChannel)
    const receiver = new DisplayReceiver(dispChannel)
    link.start()

    const content = { kind: 'slide', text: 'Ибо так возлюбил Бог мир', reference: 'От Иоанна 3:16' }
    const settings = { fontScale: 1, showReference: true }
    link.sendState(content, settings)

    expect(receiver.content).toEqual(content)
    expect(receiver.settings).toEqual(settings)
    link.stop()
  })

  it('ping/pong устанавливают connected=true без ручных reply', () => {
    const [ctrlChannel, dispChannel] = linkedPair()
    const link = new ProjectorLink(ctrlChannel)
    link.start()
    new DisplayReceiver(dispChannel)

    vi.advanceTimersByTime(2000) // первый ping → receiver сам отвечает pong
    expect(link.connected).toBe(true)

    // И держится, пока экран жив
    vi.advanceTimersByTime(10000)
    expect(link.connected).toBe(true)
    link.stop()
  })

  it('экран, открывшийся позже, получает текущее состояние через hello', () => {
    const [ctrlChannel, dispChannel] = linkedPair()
    const link = new ProjectorLink(ctrlChannel)
    link.start()
    const content = { kind: 'slide', text: 'Аллилуйя, аллилуйя', reference: 'Аллилуйя · № 156' }
    const settings = { fontScale: 1.5, showReference: false }
    link.sendState(content, settings)

    // Экран подключается уже после sendState
    const receiver = new DisplayReceiver(dispChannel)
    expect(receiver.content).toEqual(content)
    expect(receiver.settings).toEqual(settings)
    expect(link.connected).toBe(true) // hello — признак живости
    link.stop()
  })
})
