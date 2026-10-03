import { describe, it, expect, beforeEach } from 'vitest'
import { commands } from '../../src/lib/show/commands.svelte'
import { history } from '../../src/lib/show/history.svelte'
import { show } from '../../src/lib/show/show.svelte'
import { data } from '../../src/lib/data/db.svelte'
import { ui } from '../../src/lib/ui/notices.svelte'
import { projSettings } from '../../src/lib/projection/settings.svelte'
import { serviceScreen } from '../../src/lib/projection/service-screen.svelte'
import { rstDb, nrtDb, rstShiftDb, nrtShiftDb, songs, songsKk } from '../fixtures'

beforeEach(() => {
  data.bibles = { RST: rstDb, NRT: nrtDb }
  data.translation = 'RST'
  data.songs = songs
  show.kind = null
  show.title = ''
  show.subtitle = ''
  show.slides = []
  show.previewIdx = 0
  show.liveIdx = -1
  show.blackout = false
  show.verseCtx = null
  ui.clearNotice()
  history.clear()
  projSettings.reset()
  serviceScreen.resetStore()
})

describe('commands.openSong', () => {
  it('открывает песню по id из каталога', () => {
    expect(commands.openSong(1)).toBe(true)
    expect(show.kind).toBe('song')
    expect(show.title).toBe('Благодать')
    expect(show.slides).toHaveLength(2)
  })

  it('ненайденный id: false, уведомление, шоу не тронуто', () => {
    commands.openSong(1)
    expect(commands.openSong(999)).toBe(false)
    expect(ui.lastNotice).toBeTypeOf('string')
    expect(ui.lastNotice!.length).toBeGreaterThan(0)
    expect(show.title).toBe('Благодать')
    expect(show.slides).toHaveLength(2)
  })
})

describe('commands.openRef', () => {
  it('открывает главу с превью на нужном стихе', () => {
    expect(commands.openRef('JHN', 3, 2)).toBe(true)
    expect(show.kind).toBe('bible')
    expect(show.previewSlide!.reference).toBe('От Иоанна 3:2')
    expect(show.liveIdx).toBe(-1)
  })

  it('без стиха — превью на первом', () => {
    expect(commands.openRef('JHN', 3)).toBe(true)
    expect(show.previewIdx).toBe(0)
  })

  it('несуществующая глава: false и уведомление', () => {
    expect(commands.openRef('JHN', 99)).toBe(false)
    expect(ui.lastNotice).toBeTypeOf('string')
    expect(ui.lastNotice!.length).toBeGreaterThan(0)
  })
})

describe('commands.openNote', () => {
  it('заметка — ровно один слайд с текстом и заголовком в reference', () => {
    commands.openNote('Объявления', 'Молодёжная встреча — суббота, 18:00')
    expect(show.kind).toBe('note')
    expect(show.slides).toHaveLength(1)
    expect(show.slides[0].text).toBe('Молодёжная встреча — суббота, 18:00')
    expect(show.slides[0].reference).toBe('Объявления')
  })

  it('GO по заметке работает', () => {
    commands.openNote('Объявления', 'текст')
    commands.go()
    expect(show.liveIdx).toBe(0)
  })
})

describe('commands.go', () => {
  it('превью уходит в эфир, превью сдвигается дальше', () => {
    commands.openRef('JHN', 3, 1)
    commands.go()
    expect(show.liveIdx).toBe(0)
    expect(show.previewIdx).toBe(1)
  })

  it('при пустых слайдах — безопасен и не пишет в историю', () => {
    expect(() => commands.go()).not.toThrow()
    expect(show.liveIdx).toBe(-1)
    expect(history.items).toHaveLength(0)
  })
})

describe('commands — делегаты show', () => {
  it('next/prev двигают превью в границах', () => {
    commands.openRef('JHN', 3, 1)
    commands.next()
    expect(show.previewIdx).toBe(1)
    commands.next()
    expect(show.previewIdx).toBe(1)
    commands.prev()
    expect(show.previewIdx).toBe(0)
    commands.prev()
    expect(show.previewIdx).toBe(0)
  })

  it('toggleBlackout переключает затемнение', () => {
    commands.toggleBlackout()
    expect(show.blackout).toBe(true)
    commands.toggleBlackout()
    expect(show.blackout).toBe(false)
  })

  it('clearLive убирает эфир', () => {
    commands.openRef('JHN', 3, 1)
    commands.go()
    commands.clearLive()
    expect(show.liveIdx).toBe(-1)
    expect(show.liveSlide).toBeNull()
  })
})

describe('commands.setTranslation', () => {
  it('неизвестный перевод: false, уведомление, translation не меняется', () => {
    expect(commands.setTranslation('XXX')).toBe(false)
    expect(ui.lastNotice).toBeTypeOf('string')
    expect(ui.lastNotice!.length).toBeGreaterThan(0)
    expect(data.translation).toBe('RST')
  })

  it('успех: translation обновлён и глава перезагружена в новом переводе', () => {
    data.bibles = { RST: rstShiftDb, NRT: nrtShiftDb }
    commands.openRef('PSA', 41, 3)
    expect(show.previewSlide!.text).toContain('Жаждет душа моя к Богу крепкому')

    expect(commands.setTranslation('NRT')).toBe(true)
    expect(data.translation).toBe('NRT')
    // слайды реально из NRT — reloadForTranslation вызван по факту
    expect(show.subtitle).toBe('NRT')
    expect(show.previewSlide!.verse).toBe(3)
    expect(show.previewSlide!.text).toContain('стремится лань')
  })
})

describe('интеграция commands.go × history', () => {
  it('go после openRef пишет запись с точной ссылкой эфирного стиха', () => {
    commands.openRef('JHN', 3, 1)
    commands.go()
    expect(history.items).toHaveLength(1)
    expect(history.items[0].source).toEqual({
      kind: 'bible',
      code: 'JHN',
      chapter: 3,
      verse: 1,
    })
    expect(history.items[0].reference).toBe('От Иоанна 3:1')
  })

  it('каждый новый стих в эфире — новая запись', () => {
    commands.openRef('JHN', 3, 1)
    commands.go() // стих 1
    commands.go() // стих 2
    expect(history.items).toHaveLength(2)
    expect(history.items[0].reference).toBe('От Иоанна 3:2')
    expect(history.items[0].source).toEqual({
      kind: 'bible',
      code: 'JHN',
      chapter: 3,
      verse: 2,
    })
    expect(history.items[1].reference).toBe('От Иоанна 3:1')
  })

  it('go после openSong пишет source {kind: song, id}', () => {
    commands.openSong(1)
    commands.go()
    expect(history.items).toHaveLength(1)
    expect(history.items[0].source).toEqual({ kind: 'song', id: 1 })
  })

  it('листание слайдов одной песни не плодит записи: reference — без секции', () => {
    commands.openSong(1) // Благодать: куплет + припев
    commands.go() // куплет в эфир
    commands.go() // припев в эфир
    expect(history.items).toHaveLength(1)
    // дедуп по title+reference возможен только если reference не содержит секцию
    expect(history.items[0].reference).toBe('Благодать · № 310')
  })
})

describe('commands.go × подсветка строки в песне', () => {
  function songShow() {
    show.kind = 'song'
    show.slides = [
      { label: 'Куплет', text: 'Раз\nДва\n\nТри', reference: 'Песня · Куплет' },
      { label: 'Припев', text: 'Четыре', reference: 'Песня · Припев' },
    ]
    show.previewIdx = 0
    show.liveIdx = -1
  }

  it('подсветка выключена — GO листает слайды, как раньше', () => {
    songShow()
    commands.go()
    commands.go()
    expect(show.liveIdx).toBe(1)
  })

  it('подсветка включена — GO сначала идёт по непустым строкам, потом к слайду', () => {
    projSettings.setText({ lineHighlight: true })
    songShow()
    commands.go()
    expect([show.liveIdx, show.liveLine]).toEqual([0, 0])
    commands.go()
    expect([show.liveIdx, show.liveLine]).toEqual([0, 1])
    commands.go() // пустая строка пропускается: «Три» — третья непустая
    expect([show.liveIdx, show.liveLine]).toEqual([0, 2])
    commands.go()
    expect([show.liveIdx, show.liveLine]).toEqual([1, 0])
  })

  it('шаг по строке не пишет лишнюю запись в историю', () => {
    projSettings.setText({ lineHighlight: true })
    commands.openSong(4) // «Строка один / Строка два»
    commands.go()
    commands.go()
    expect(show.liveLine).toBe(1)
    expect(history.items).toHaveLength(1)
  })

  it('оператор выбрал в превью другой слайд — GO отправляет его, строки не трогает', () => {
    projSettings.setText({ lineHighlight: true })
    songShow()
    show.slides = [...show.slides, { label: 'Кода', text: 'Пять', reference: 'Песня · Кода' }]
    commands.go() // куплет в эфире, в превью припев
    show.setPreview(2) // оператор перескочил на коду
    commands.go()
    expect([show.liveIdx, show.liveLine]).toEqual([2, 0])
  })

  it('в Библии подсветка не действует', () => {
    projSettings.setText({ lineHighlight: true })
    commands.openRef('JHN', 3, 1)
    commands.go()
    commands.go()
    expect(show.liveIdx).toBe(1)
  })

  it('blackout не даёт шагать по строкам вслепую', () => {
    projSettings.setText({ lineHighlight: true })
    songShow()
    commands.go()
    show.blackout = true
    commands.go()
    expect(show.liveIdx).toBe(1)
  })
})

describe('commands × служебный экран', () => {
  it('GO во время отсчёта убирает заставку и отправляет превью в эфир', () => {
    commands.openRef('JHN', 3, 1)
    serviceScreen.show('countdown')
    commands.go()
    expect(serviceScreen.mode).toBe('off')
    expect(show.liveIdx).toBe(0)
  })

  it('GO после заставки не шагает по строкам песни, а выводит слайд', () => {
    projSettings.setText({ lineHighlight: true })
    commands.openSong(4)
    commands.go() // строка 1 в эфире
    serviceScreen.show('welcome')
    commands.go()
    expect(serviceScreen.mode).toBe('off')
    expect(show.liveLine).toBe(0)
  })

  it('без слайдов GO заставку не трогает', () => {
    serviceScreen.show('welcome')
    commands.go()
    expect(serviceScreen.mode).toBe('welcome')
  })

  it('«Очистить» убирает и заставку', () => {
    serviceScreen.show('countdown')
    commands.clearLive()
    expect(serviceScreen.mode).toBe('off')
  })
})

describe('commands.openSong — песни других языков', () => {
  it('база ещё грузится — понятное уведомление, а не «не найдена»', () => {
    data.songStatus = { ru: 'ready', kk: 'loading' }
    expect(commands.openSong(1_000_001, 'Иса - Ұлы Патша')).toBe(false)
    expect(ui.lastNotice).toMatch(/Қазақша.*загружаются/)
  })

  it('база не загрузилась — уведомление говорит об этом', () => {
    data.songStatus = { ru: 'ready', kk: 'error' }
    expect(commands.openSong(1_000_001)).toBe(false)
    expect(ui.lastNotice).toMatch(/Қазақша.*не загрузились/)
  })

  it('история открывает песню по подписи, если id съехал', () => {
    data.songs = [...songs, ...songsKk]
    expect(commands.openSource({ kind: 'song', id: 1_000_001 }, 'Көтерілді шаңырақ')).toBe(true)
    expect(show.title).toBe('Көтерілді шаңырақ')
  })
})

describe('commands.openSource — повтор из истории', () => {
  it('песня — по id', () => {
    expect(commands.openSource({ kind: 'song', id: 2 })).toBe(true)
    expect(show.title).toBe('1000 рук')
  })

  it('стих — глава в превью на нужном стихе', () => {
    expect(commands.openSource({ kind: 'bible', code: 'JHN', chapter: 3, verse: 2 })).toBe(true)
    expect(show.kind).toBe('bible')
    expect(show.previewSlide?.verse).toBe(2)
  })

  it('заметка — заголовок и текст как были', () => {
    expect(commands.openSource({ kind: 'note', title: 'Объявления', text: 'Чай после служения' })).toBe(true)
    expect(show.slides).toEqual([
      { label: 'Заметка', text: 'Чай после служения', reference: 'Объявления' },
    ])
  })

  it('песни больше нет в каталоге — false и уведомление', () => {
    expect(commands.openSource({ kind: 'song', id: 999 })).toBe(false)
    expect(ui.lastNotice).toBeTruthy()
  })
})
