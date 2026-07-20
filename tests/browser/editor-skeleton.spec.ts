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

test('editor skeleton height matches the loaded editor height', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html')
  await expect(page.locator('.cm-editor')).toBeVisible()

  const heights = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('.code-editor-host')
    const editor = host?.querySelector<HTMLElement>('.cm-editor')
    if (!host || !editor) throw new Error('Missing editor host')

    const skeleton = document.createElement('div')
    skeleton.className = 'editor-skeleton'
    host.parentElement?.append(skeleton)
    const skeletonHeight = skeleton.getBoundingClientRect().height
    skeleton.remove()

    return { skeleton: skeletonHeight, editor: editor.getBoundingClientRect().height }
  })

  expect(Math.abs(heights.skeleton - heights.editor)).toBeLessThanOrEqual(4)
})
