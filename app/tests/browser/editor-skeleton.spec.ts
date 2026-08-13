import { expect, test } from '@playwright/test'

type FrameSample = { hasSkeleton: boolean; hasEditor: boolean }

declare global {
  interface Window {
    editorHostFrames: FrameSample[]
  }
}

test('editor host is never painted empty while the editor loads', async ({ page }) => {
  await page.addInitScript(() => {
    window.editorHostFrames = []
    const sampleFrame = () => {
      const host = document.querySelector('.code-editor-host')
      if (host) {
        window.editorHostFrames.push({
          hasSkeleton: host.querySelector('.editor-skeleton') !== null,
          hasEditor: host.querySelector('.cm-editor') !== null,
        })
      }
      requestAnimationFrame(sampleFrame)
    }
    requestAnimationFrame(sampleFrame)
  })

  await page.goto('/tests/browser/app.fixture.html')
  await expect(page.locator('.cm-editor')).toBeVisible()
  await expect(page.locator('.cm-content')).toContainText('createTask')

  const frames = await page.evaluate(() => window.editorHostFrames)
  expect(frames.length).toBeGreaterThan(0)
  expect(frames.filter((frame) => !frame.hasSkeleton && !frame.hasEditor)).toEqual([])

  await expect(page.locator('.editor-skeleton')).toHaveCount(0)
})
