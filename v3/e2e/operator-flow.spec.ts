import { expect, test } from '@playwright/test'

test('точная ссылка проходит Preview → Live и переживает перезагрузку', async ({ page }) => {
  test.setTimeout(60_000)

  await page.goto('/')
  await expect(page.getByText(/11 524 песен|11524 песен/)).toBeVisible({ timeout: 30_000 })

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
