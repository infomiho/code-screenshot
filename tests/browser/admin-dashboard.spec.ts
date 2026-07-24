import { expect, test } from '@playwright/test'

const adminDashboardUrl = '/tests/browser/app.fixture.html?admin-dashboard'

test('presents the database and Plausible overview', async ({ page }) => {
  await page.goto(adminDashboardUrl)

  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Database' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plausible' })).toBeVisible()
  await expect(page.locator('.account-menu-trigger')).toContainText('@codeshot-user')
  await page.locator('.account-menu-trigger').click()
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Users and ambient counts' })).toContainText('@codeshot-user')
  await expect(page.getByRole('img', { name: 'Daily visitors and pageviews over 30 days' })).toBeVisible()
  await expect(page.getByText('Screenshot Downloaded')).toBeVisible()
})

test('fits the admin dashboard on a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(adminDashboardUrl)

  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(hasHorizontalOverflow).toBe(false)
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible()
})
