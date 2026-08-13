import { expect, test } from '@playwright/test'

test('renders injected code as an export-ready screenshot frame', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html?screenshot-render')

  const renderPage = page.locator('.screenshot-render-page')
  await expect(renderPage).toHaveAttribute('data-screenshot-state', 'ready')
  const frame = page.locator('.shot-frame')
  await expect(frame).toHaveClass(/shot-frame--macos/)
  await expect(frame).toHaveClass(/shot-frame--exporting/)
  await expect(frame).toHaveCSS('width', '860px')
  await expect(frame.getByText('answer.ts')).toBeVisible()
  await expect(frame.getByText('const answer = 42')).toBeVisible()
  await expect(frame.locator('.cm-highlighted-line')).toHaveCount(1)
})
