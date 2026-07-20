import { expect, test } from '@playwright/test'

const openAppFixture = async (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/tests/browser/app.fixture.html')
  await page.waitForTimeout(100)
  expect(errors).toEqual([])
  await expect(page.locator('.cm-editor')).toBeVisible()
}

const drawStroke = async (
  page: import('@playwright/test').Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) => {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
}

const ambientNames = [
  'macOS window',
  'Technical plate',
  'Specimen card',
  'Swiss poster',
  'Field notebook',
  'Bare-metal terminal',
]

for (const ambientName of ambientNames) {
  test(`pen draws a stroke over the code editor (${ambientName})`, async ({ page }) => {
    await openAppFixture(page)
    await page.locator('.ambient-current').click()
    await page.getByRole('option', { name: ambientName }).click()
    await expect(page.locator('.cm-editor')).toBeVisible()
    await page.getByRole('button', { name: 'Draw', exact: true }).click()

    const editorBox = await page.locator('.cm-content').boundingBox()
    if (!editorBox) throw new Error('Missing editor bounds')

    const editorCenter = {
      x: editorBox.x + editorBox.width / 2,
      y: editorBox.y + editorBox.height / 2,
    }
    await drawStroke(page, editorCenter, { x: editorCenter.x + 80, y: editorCenter.y + 30 })

    await expect(page.locator('.draw-layer path')).toHaveCount(1)
  })
}

test('pen draws a stroke on the frame outside the code editor', async ({ page }) => {
  await openAppFixture(page)
  await page.getByRole('button', { name: 'Draw', exact: true }).click()

  const frameBox = await page.locator('.shot-frame').boundingBox()
  if (!frameBox) throw new Error('Missing frame bounds')

  const frameEdge = { x: frameBox.x + 12, y: frameBox.y + frameBox.height / 2 }
  await drawStroke(page, frameEdge, { x: frameEdge.x + 30, y: frameEdge.y - 40 })

  await expect(page.locator('.draw-layer path')).toHaveCount(1)
})
