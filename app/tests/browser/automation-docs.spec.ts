import { expect, test } from '@playwright/test'

test('serves automation docs with account controls', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html?automation-docs')

  await expect(page.getByRole('heading', { level: 1, name: 'Automation docs' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'codeshot.dev CLI' })).toHaveAttribute('href', 'https://www.npmjs.com/package/codeshot.dev')
  await expect(page.locator('.automation-docs-code')).toHaveCount(4)
  await expect(page.getByRole('link', { name: 'View supported API capabilities' })).toHaveAttribute('href', 'https://api.codeshot.dev/v1/capabilities')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.site-header').getByText('@codeshot-user')).toBeVisible()
  await expect(page.locator('.site-footer').getByRole('link')).toHaveCount(3)
})

test('reflows automation docs without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 })
  await page.goto('/tests/browser/app.fixture.html?automation-docs')

  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  expect(dimensions.width).toBe(dimensions.viewport)
  await expect(page.getByRole('link', { name: 'Automation docs' })).toBeVisible()
})
