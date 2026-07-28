import { expect, test, type Page } from '@playwright/test'

async function openReadyApp(page: Page) {
  await page.goto('/')
  await expect(page.getByText(/11 524 песен|11524 песен/)).toBeVisible({ timeout: 30_000 })
}

test.setTimeout(60_000)

test.beforeEach(async ({ page }) => {
  await openReadyApp(page)
})

test('точная ссылка проходит Preview → Live и переживает перезагрузку', async ({ page }) => {
  const search = page.getByPlaceholder('Стих, песня или текст…')
  await search.fill('ин 3 16')
  await page.getByRole('option', { name: /От Иоанна 3:16\s+RST/ }).click()

  const preview = page.getByRole('region', { name: 'Предпросмотр' })
  await expect(preview).toContainText('Ибо так возлюбил Бог мир')
  await expect(preview).toContainText('От Иоанна 3:16')

  await page.getByRole('button', { name: 'Добавить' }).click()
  await expect(page.getByRole('button', { name: /От Иоанна 3:16\s+Библия/ })).toBeVisible()

  await page.getByRole('button', { name: /GO\s+Space/ }).click()

  const live = page.getByRole('region', { name: 'Эфир' })
  await expect(live).toContainText('Ибо так возлюбил Бог мир')
  await expect(live).toContainText('От Иоанна 3:16')

  const library = page.getByRole('complementary', { name: 'Библиотека' })
  await page.getByRole('button', { name: 'История' }).click()
  await expect(library.getByRole('button', { name: /От Иоанна 3:16/ })).toBeVisible()

  await page.reload()
  await expect(page.getByText(/11 524 песен|11524 песен/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: /От Иоанна 3:16\s+Библия/ })).toBeVisible()

  await page.getByRole('button', { name: 'История' }).click()
  await expect(library.getByRole('button', { name: /От Иоанна 3:16/ })).toBeVisible()
})

test('песня с несколькими секциями переключается и уходит в Live', async ({ page }) => {
  const search = page.getByPlaceholder('Стих, песня или текст…')
  await search.fill('1000 рук')
  await page.getByRole('option', { name: /1000 рук\s+№ 579/ }).click()

  await expect(page.getByText('№ 579 · 3 слайдов')).toBeVisible()

  const preview = page.getByRole('region', { name: 'Предпросмотр' })
  await expect(preview).toContainText('Слышу пенье цветов')
  await expect(preview).toContainText('Куплет 1')

  await page.getByRole('button', { name: /Припев 1/ }).click()
  await expect(preview).toContainText('Тысячи лиц, тысячи глаз и судеб')
  await expect(preview).toContainText('Припев 1')

  await page.getByRole('button', { name: 'Добавить' }).click()
  const setlistSong = page.getByRole('button', { name: '1000 рук · № 579 Песня' })
  await expect(setlistSong).toBeVisible()

  await page.getByRole('button', { name: /GO\s+Space/ }).click()

  const live = page.getByRole('region', { name: 'Эфир' })
  await expect(live).toContainText('Тысячи лиц, тысячи глаз и судеб')
  await expect(live).toContainText('1000 рук · № 579 · Припев 1')
  await expect(preview).toContainText('Счастья жаждет душа')

  const library = page.getByRole('complementary', { name: 'Библиотека' })
  await page.getByRole('button', { name: 'История' }).click()
  await expect(library.getByRole('button', { name: /1000 рук · № 579/ })).toBeVisible()

  await page.reload()
  await expect(page.getByText(/11 524 песен|11524 песен/)).toBeVisible({ timeout: 30_000 })
  await expect(setlistSong).toBeVisible()

  await setlistSong.click()
  await expect(page.getByText('№ 579 · 3 слайдов')).toBeVisible()
})

test('порядок создаётся, переставляется, экспортируется и импортируется', async ({ page }) => {
  const setlist = page.getByRole('complementary', { name: 'Порядок служения' })

  await setlist.getByRole('button', { name: 'Создать заметку' }).click()
  const noteDialog = page.getByRole('dialog', { name: 'Новая заметка' })
  await noteDialog.getByLabel('Заголовок').fill('Объявления')
  await noteDialog.getByLabel('Текст').fill('После служения состоится общая встреча.')
  await noteDialog.getByRole('button', { name: 'Добавить' }).click()

  const search = page.getByPlaceholder('Стих, песня или текст…')
  await search.fill('ин 3 16')
  await page.getByRole('option', { name: /От Иоанна 3:16\s+RST/ }).click()
  await setlist.getByRole('button', { name: 'Добавить' }).click()

  await search.fill('1000 рук')
  await page.getByRole('option', { name: /1000 рук\s+№ 579/ }).click()
  await setlist.getByRole('button', { name: 'Добавить' }).click()

  const songItem = setlist.getByRole('button', { name: '1000 рук · № 579 Песня' })
  await songItem.focus()
  await setlist
    .getByRole('button', { name: 'Переместить «1000 рук · № 579» выше' })
    .click()

  const entries = setlist.getByRole('listitem')
  await expect(entries).toHaveCount(3)
  await expect(entries.nth(0)).toContainText('Объявления')
  await expect(entries.nth(1)).toContainText('1000 рук · № 579')
  await expect(entries.nth(2)).toContainText('От Иоанна 3:16')

  await page.reload()
  await expect(page.getByText(/11 524 песен|11524 песен/)).toBeVisible({ timeout: 30_000 })
  await expect(entries).toHaveCount(3)
  await expect(entries.nth(0)).toContainText('Объявления')
  await expect(entries.nth(1)).toContainText('1000 рук · № 579')
  await expect(entries.nth(2)).toContainText('От Иоанна 3:16')

  const downloadPromise = page.waitForEvent('download')
  await setlist.getByRole('button', { name: 'Экспортировать порядок' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^bible-projector-setlist-\d{4}-\d{2}-\d{2}\.json$/)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const exported = Buffer.concat(chunks)
  const payload = JSON.parse(exported.toString('utf8')) as {
    version: number
    items: Array<{ kind: string; title: string; text?: string }>
  }

  expect(payload.version).toBe(1)
  expect(payload.items.map(({ kind, title }) => ({ kind, title }))).toEqual([
    { kind: 'note', title: 'Объявления' },
    { kind: 'song', title: '1000 рук · № 579' },
    { kind: 'bible', title: 'От Иоанна 3:16' },
  ])
  expect(payload.items[0].text).toBe('После служения состоится общая встреча.')

  page.once('dialog', (dialog) => dialog.accept())
  await setlist.getByRole('button', { name: 'Очистить порядок' }).click()
  await expect(entries).toHaveCount(0)

  await setlist.locator('input[type="file"]').setInputFiles({
    name: download.suggestedFilename(),
    mimeType: 'application/json',
    buffer: exported,
  })
  await expect(entries).toHaveCount(3)
  await expect(entries.nth(0)).toContainText('Объявления')
  await expect(entries.nth(1)).toContainText('1000 рук · № 579')
  await expect(entries.nth(2)).toContainText('От Иоанна 3:16')

  await page.reload()
  await expect(page.getByText(/11 524 песен|11524 песен/)).toBeVisible({ timeout: 30_000 })
  await expect(entries).toHaveCount(3)
  await expect(page.getByRole('region', { name: 'Предпросмотр' })).toContainText(
    'После служения состоится общая встреча.',
  )
})

test('порядок, история и настройки проекции восстанавливаются после перезагрузки', async ({
  page,
}) => {
  const search = page.getByPlaceholder('Стих, песня или текст…')
  await search.fill('ин 3 16')
  await page.getByRole('option', { name: /От Иоанна 3:16\s+RST/ }).click()

  const setlist = page.getByRole('complementary', { name: 'Порядок служения' })
  await setlist.getByRole('button', { name: 'Добавить' }).click()
  await page.getByRole('button', { name: /GO\s+Space/ }).click()

  const settingsButton = page.getByRole('button', { name: 'Настройки проекции' })
  await settingsButton.click()

  const settings = page.getByRole('group', { name: 'Настройки проекции' })
  const fontScale = settings.getByRole('slider', { name: 'Масштаб шрифта' })
  const showReference = settings.getByRole('checkbox', {
    name: 'Показывать ссылку на экране',
  })

  await fontScale.fill('1.35')
  await showReference.uncheck()
  await expect(fontScale).toHaveValue('1.35')
  await expect(showReference).not.toBeChecked()
  await expect(settings).toContainText('135%')

  await settingsButton.click()
  await page.reload()
  await expect(page.getByText(/11 524 песен|11524 песен/)).toBeVisible({ timeout: 30_000 })

  await expect(
    setlist.getByRole('button', { name: /От Иоанна 3:16\s+Библия/ }),
  ).toBeVisible()

  const preview = page.getByRole('region', { name: 'Предпросмотр' })
  await expect(preview).toContainText('Ибо так возлюбил Бог мир')
  await expect(preview).not.toContainText('От Иоанна 3:16')

  await settingsButton.click()
  await expect(fontScale).toHaveValue('1.35')
  await expect(showReference).not.toBeChecked()
  await expect(settings).toContainText('135%')

  const library = page.getByRole('complementary', { name: 'Библиотека' })
  await page.getByRole('button', { name: 'История' }).click()
  await expect(library.getByRole('button', { name: /От Иоанна 3:16/ })).toBeVisible()
})

test('окно проектора подключается, получает эфир и честно отключается', async ({ page }) => {
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Открыть экран' }).click()
  const display = await popupPromise

  await expect(display).toHaveURL(/#display$/)
  await expect(display).toHaveTitle('Bible Projector — экран')
  await expect(page.getByText('Проектор подключён')).toBeVisible({ timeout: 5_000 })

  const search = page.getByPlaceholder('Стих, песня или текст…')
  await search.fill('ин 3 16')
  await page.getByRole('option', { name: /От Иоанна 3:16\s+RST/ }).click()
  await page.getByRole('button', { name: /GO\s+Space/ }).click()

  const screen = display.getByRole('main', { name: 'Экран проектора' })
  await expect(screen).toContainText('Ибо так возлюбил Бог мир')
  await expect(screen).toContainText('От Иоанна 3:16')

  const blackout = page.getByRole('button', { name: /Blackout\s+B/ })
  await blackout.click()
  await expect(screen).not.toContainText('Ибо так возлюбил Бог мир')

  await blackout.click()
  await expect(screen).toContainText('Ибо так возлюбил Бог мир')

  await display.close()
  await expect(page.getByRole('button', { name: 'Открыть экран' })).toBeVisible({
    timeout: 12_000,
  })
  await expect(page.getByText('Проектор подключён')).not.toBeVisible()
})

test('окно проектора закрывается кнопкой пульта, эфир при этом не трогаем', async ({ page }) => {
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: 'Открыть экран' }).click()
  const display = await popupPromise
  await expect(page.getByText('Проектор подключён')).toBeVisible({ timeout: 5_000 })

  const search = page.getByPlaceholder('Стих, песня или текст…')
  await search.fill('ин 3 16')
  await page.getByRole('option', { name: /От Иоанна 3:16\s+RST/ }).click()
  await page.getByRole('button', { name: /GO\s+Space/ }).click()

  const live = page.getByRole('region', { name: 'Эфир' })
  await expect(live).toContainText('Ибо так возлюбил Бог мир')

  // «Очистить» гасит текст, но окно проектора остаётся открытым:
  // между песнями его закрывать нельзя, иначе каждый раз открывать заново
  await page.getByRole('button', { name: /Очистить\s+Esc/ }).click()
  await expect(live).not.toContainText('Ибо так возлюбил Бог мир')
  await expect(page.getByText('Проектор подключён')).toBeVisible()
  expect(display.isClosed()).toBe(false)

  // Закрытие — только явной кнопкой
  await page.getByRole('button', { name: 'Закрыть экран' }).click()
  await expect.poll(() => display.isClosed(), { timeout: 10_000 }).toBe(true)
  await expect(page.getByRole('button', { name: 'Открыть экран' })).toBeVisible({
    timeout: 12_000,
  })
})
