import { describe, it, expect, vi } from 'vitest'
import { DisplayMedia, MEDIA_RETRY_MS } from '../../src/lib/projector/display-media.svelte'
import { NO_MEDIA, type MediaRefs } from '../../src/lib/media/protocol'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const refs = (version: string | null): MediaRefs => ({
  ...NO_MEDIA,
  background: version ? { version, kind: 'image' } : null,
})

function setup() {
  let now = 1_000_000
  const request = vi.fn()
  const media = new DisplayMedia(request, () => now)
  return { media, request, advance: (ms: number) => (now += ms) }
}

describe('DisplayMedia — свои файлы на экране проектора', () => {
  it('запрашивает недостающий файл, но не чаще раза в MEDIA_RETRY_MS', () => {
    const { media, request, advance } = setup()
    media.sync(refs('v1'))
    media.sync(refs('v1'))
    expect(request).toHaveBeenCalledTimes(1)
    expect(request).toHaveBeenCalledWith('background')
    advance(MEDIA_RETRY_MS)
    media.sync(refs('v1'))
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('принимает ответ нужной версии и больше не спрашивает', async () => {
    const { media, request, advance } = setup()
    media.sync(refs('v1'))
    await media.accept({ slot: 'background', version: 'v1', dataUrl: PNG }, refs('v1'))
    expect(media.loaded.background).toMatchObject({ version: 'v1', kind: 'image' })
    expect(media.loaded.background?.url).toMatch(/^blob:/)
    advance(MEDIA_RETRY_MS)
    media.sync(refs('v1'))
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('ответ устаревшей версии игнорируется', async () => {
    const { media } = setup()
    await media.accept({ slot: 'background', version: 'old', dataUrl: PNG }, refs('new'))
    expect(media.loaded.background).toBeNull()
  })

  it('файл убрали в пульте — экран его выбрасывает', async () => {
    const { media } = setup()
    await media.accept({ slot: 'background', version: 'v1', dataUrl: PNG }, refs('v1'))
    media.sync(refs(null))
    expect(media.loaded.background).toBeNull()
  })

  it('ответ «файла больше нет» тоже выбрасывает загруженное', async () => {
    const { media } = setup()
    await media.accept({ slot: 'background', version: 'v1', dataUrl: PNG }, refs('v1'))
    await media.accept({ slot: 'background', version: '', dataUrl: null }, refs('v1'))
    expect(media.loaded.background).toBeNull()
  })
})
