import { expect, test } from '@playwright/test'

const adminDashboardUrl = '/tests/browser/app.fixture.html?admin-dashboard'
const adminLoadingUrl = '/tests/browser/app.fixture.html?admin-loading'

test('presents the database and Plausible overview', async ({ page }) => {
  await page.goto(adminDashboardUrl)

  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Database' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plausible' })).toBeVisible()
  await expect(page.locator('.account-menu-trigger')).toContainText('@codeshot-user')
  await page.locator('.account-menu-trigger').click()
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Users and ambient counts' })).toContainText('@codeshot-user')
  const chart = page.getByRole('application', { name: 'Daily visitors and pageviews over 30 days' })
  await expect(chart).toBeVisible()
  await chart.hover()
  const expectedDate = await page.evaluate(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    .format(new Date('2026-07-15T00:00:00')))
  await expect(page.locator('.admin-chart-tooltip')).toContainText(expectedDate)
  await expect(page.locator('.admin-chart-tooltip')).toContainText('Visitors 50')
  await expect(page.locator('.admin-chart-tooltip')).toContainText('Pageviews 124')
  await page.mouse.move(0, 0)
  await chart.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.admin-chart-tooltip')).toContainText('Visitors 37')
  await expect(page.locator('.admin-chart-tooltip')).toContainText('Pageviews 77')
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

test('shows layout-matched skeletons while admin data loads', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(adminLoadingUrl)

  await expect(page.locator('.admin-skeleton-content')).toHaveCount(2)
  await expect(page.getByRole('status').filter({ hasText: 'Loading database statistics' })).toBeAttached()
  await expect(page.getByRole('status').filter({ hasText: 'Loading Plausible statistics' })).toBeAttached()
  await expect(page.locator('.admin-skeleton-metric')).toHaveCount(10)
  const skeletonChartHeight = await page.locator('.admin-skeleton-chart-plot')
    .evaluate((element) => element.getBoundingClientRect().height)
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(hasHorizontalOverflow).toBe(false)

  await page.goto(adminDashboardUrl)
  const chartHeight = await page.getByRole('application', { name: 'Daily visitors and pageviews over 30 days' })
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(Math.abs(chartHeight - skeletonChartHeight)).toBeLessThan(2)
})
