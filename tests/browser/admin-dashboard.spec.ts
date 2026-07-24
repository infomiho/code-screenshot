import { expect, test, type Page } from '@playwright/test'

const adminDashboardUrl = '/tests/browser/app.fixture.html?admin-dashboard'
const adminLoadingUrl = '/tests/browser/app.fixture.html?admin-loading'
const sparseAdminDashboardUrl = '/tests/browser/app.fixture.html?admin-sparse'
const emptyAdminDashboardUrl = '/tests/browser/app.fixture.html?admin-empty'

const formatFixturePeriod = (page: Page) => page.evaluate(() => {
  const formatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return `${formatter.format(new Date('2026-07-01T00:00:00'))}–${formatter.format(new Date('2026-07-30T00:00:00'))}`
})

test('presents product outcomes before workspace inventory', async ({ page }) => {
  await page.goto(adminDashboardUrl)

  await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Product pulse' })).toBeVisible()
  await expect(page.getByText(await formatFixturePeriod(page))).toBeVisible()
  await expect(page.getByText('1,240 visitors reached codeshot.dev; 506 screenshot output actions')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Product actions' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Workspace inventory' })).toBeVisible()
  const sectionHeadings = await page.locator('.admin-section-heading h2').allTextContents()
  expect(sectionHeadings).toEqual(['Product pulse', 'Workspace inventory'])
  await expect(page.locator('.account-menu-trigger')).toContainText('@codeshot-user')
  await page.locator('.account-menu-trigger').click()
  await expect(page.getByRole('menuitem', { name: 'Admin' })).toBeVisible()
  await expect(page.getByRole('table', { name: 'Users and ambient counts' })).toContainText('@codeshot-user')
  const chart = page.getByRole('application', { name: 'Daily visitors over 30 days' })
  await expect(chart).toBeVisible()
  await chart.hover()
  const expectedDate = await page.evaluate(() => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    .format(new Date('2026-07-15T00:00:00')))
  await expect(page.locator('.admin-chart-tooltip')).toContainText(expectedDate)
  await expect(page.locator('.admin-chart-tooltip')).toContainText('Visitors 50')
  await page.mouse.move(0, 0)
  await chart.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('.admin-chart-tooltip')).toContainText('Visitors 37')
  await expect(page.getByText('Screenshot Downloaded')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Produce' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Save and refine' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Share', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Assist' })).toBeVisible()
})

test('uses a compact active-day list for sparse traffic', async ({ page }) => {
  await page.goto(sparseAdminDashboardUrl)

  await expect(page.getByText('1 visitor reached codeshot.dev; 1 screenshot output action')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Active days' })).toBeVisible()
  const expectedDate = await page.evaluate(() => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    .format(new Date('2026-07-24T00:00:00')))
  await expect(page.locator('.admin-sparse-traffic-row')).toContainText(expectedDate)
  await expect(page.locator('.admin-sparse-traffic-row strong')).toHaveText('1')
  await expect(page.getByRole('application', { name: 'Daily visitors over 30 days' })).toHaveCount(0)
})

test('states the reporting period when no traffic was recorded', async ({ page }) => {
  await page.goto(emptyAdminDashboardUrl)

  await expect(page.getByText(`No visitors recorded from ${await formatFixturePeriod(page)}.`)).toBeVisible()
  await expect(page.getByText('0 visitors reached codeshot.dev; 0 screenshot output actions')).toBeVisible()
  await expect(page.locator('.admin-action-row[data-empty]')).toHaveCount(8)
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
  await expect(page.locator('.admin-skeleton-metric')).toHaveCount(5)
  await expect(page.locator('.admin-skeleton-action-track')).toHaveCount(8)
  const skeletonChartHeight = await page.locator('.admin-skeleton-chart-plot')
    .evaluate((element) => element.getBoundingClientRect().height)
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(hasHorizontalOverflow).toBe(false)

  await page.goto(adminDashboardUrl)
  const chartHeight = await page.getByRole('application', { name: 'Daily visitors over 30 days' })
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(Math.abs(chartHeight - skeletonChartHeight)).toBeLessThan(2)
})
