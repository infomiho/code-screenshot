import { expect, test } from '@playwright/test'

type ExportResult = {
  blobSize: number
  dimensions: { width: number; height: number }
  gutterVisibility: string
  liveTextStyles: Array<{ className: string; color: string; text: string }>
  mimeType: string
  pixels: Record<string, number>
}

const widths = [420, 860, 1280]

for (const width of widths) {
  test(`exports open shadow content and slotted CodeMirror at ${width}px`, async ({ page }) => {
    await page.goto('/tests/browser/shadow-export.fixture.html')
    await page.waitForFunction(() => typeof window.exportShadowFixture === 'function')

    const result = await page.evaluate(
      (fixtureWidth) => window.exportShadowFixture(fixtureWidth, 'show'),
      width,
    ) as ExportResult

    expect(result.mimeType).toBe('image/png')
    expect(result.blobSize).toBeGreaterThan(10_000)
    expect(result.dimensions.width).toBe(width * 2)
    expect(result.dimensions.height).toBeGreaterThan(300)
    expect(result.gutterVisibility).toBe('visible')
    expect(result.liveTextStyles).toContainEqual(
      expect.objectContaining({ color: 'rgb(34, 211, 238)' }),
    )
    expect(result.pixels.ground).toBeGreaterThan(1_000)
    expect(result.pixels.keyword).toBeGreaterThan(10)
    expect(result.pixels.highlight).toBeGreaterThan(1_000)
    expect(result.pixels.gutter).toBeGreaterThan(10)
    expect(result.pixels.annotation).toBeGreaterThan(100)
  })
}

test('hides the gutter only in the generated export state', async ({ page }) => {
  await page.goto('/tests/browser/shadow-export.fixture.html')
  await page.waitForFunction(() => typeof window.exportShadowFixture === 'function')

  const result = await page.evaluate(
    () => window.exportShadowFixture(860, 'hide'),
  ) as ExportResult

  expect(result.gutterVisibility).toBe('hidden')
  expect(result.pixels.gutter).toBe(0)
  expect(result.pixels.keyword).toBeGreaterThan(10)
})
