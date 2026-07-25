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
  await page.getByRole('button', { name: /От Иоанна 3:16\s+RST/ }).click()

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
  await page.getByRole('button', { name: /1000 рук\s+№ 579/ }).click()

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
