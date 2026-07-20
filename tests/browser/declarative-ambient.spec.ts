import { expect, test } from '@playwright/test'

const selectSwissPoster = async (page: import('@playwright/test').Page) => {
  await page.locator('.ambient-current').click()
  await page.getByRole('option', { name: 'Swiss poster' }).click()
}

const openAppFixture = async (page: import('@playwright/test').Page) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/tests/browser/app.fixture.html')
  await page.waitForTimeout(100)
  expect(errors).toEqual([])
  await expect(page.locator('.cm-editor')).toBeVisible()
}

test('renders Swiss Poster declaratively without recreating CodeMirror', async ({ page }) => {
  await openAppFixture(page)
  await page.evaluate(() => {
    Object.assign(window, { editorBeforeAmbientSwitch: document.querySelector('.cm-editor') })
  })

  await selectSwissPoster(page)

  expect(await page.evaluate(() => {
    const host = document.querySelector('.declarative-ambient')
    return {
      hasShadowRoot: host?.shadowRoot !== null,
      sameEditor: document.querySelector('.cm-editor') === (window as Window & {
        editorBeforeAmbientSwitch?: Element
      }).editorBeforeAmbientSwitch,
      title: host?.shadowRoot?.querySelector('.swiss-header h2')?.textContent,
      titleTooltip: host?.shadowRoot?.querySelector('.swiss-header h2 span')?.getAttribute('title'),
    }
  })).toEqual({
    hasShadowRoot: true,
    sameEditor: true,
    title: 'top secret code',
    titleTooltip: 'top secret code',
  })

  await page.locator('#ambient-title').fill('')
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('.declarative-ambient')?.shadowRoot
      ?.querySelector('.swiss-header h2')?.textContent,
  )).toBe('Untitled')
})

test('renders the Swiss Poster thumbnail consistently in both picker contexts', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html')
  const current = page.locator('.ambient-current')
  await current.click()
  await page.getByRole('option', { name: 'Swiss poster' }).click()
  await current.click()

  const thumbnails = await page.evaluate(() => {
    const inspect = (host: Element | null) => {
      const poster = host?.shadowRoot?.querySelector<HTMLElement>('.poster')
      if (!poster) return null
      const rect = poster.getBoundingClientRect()
      return { background: getComputedStyle(poster).backgroundColor, height: rect.height, width: rect.width }
    }
    const option = [...document.querySelectorAll('.ambient-picker-option')]
      .find((element) => element.textContent?.includes('Swiss poster'))
    return {
      current: inspect(document.querySelector('.ambient-current .ambient-mark')),
      option: inspect(option?.querySelector('.ambient-mark') ?? null),
    }
  })

  expect(thumbnails.current?.background).toBe(thumbnails.option?.background)
  expect(thumbnails.current?.width).toBeGreaterThan(20)
  expect(thumbnails.option?.width).toBeGreaterThan(20)
})

test('contains user thumbnail dimensions inside the ambient mark', async ({ page }) => {
  await openAppFixture(page)
  await page.evaluate(() => {
    window.ambientWorkspaceService.signIn()
    window.ambientWorkspaceService.beginAmbient()
    const draft = window.ambientWorkspaceService.getSnapshot().draft
    if (!draft) throw new Error('Missing draft')
    draft.document.thumbnail.stylesheet = `
      :host {
        display: block;
        width: 860px;
        height: 400px;
        background: green;
      }
    `
    window.ambientWorkspaceService.createAmbient('Oversized thumbnail')
  })

  const mark = page.locator('.ambient-current .ambient-mark')
  await expect(mark).toBeVisible()
  await expect(mark).toHaveCSS('width', '40px')
  await expect(mark).toHaveCSS('height', '28px')
  await expect(page.locator('.ambient-selector')).toHaveCSS('height', '44px')
})

for (const width of [420, 860, 1280]) {
  test(`exports the declarative Swiss Poster at ${width}px`, async ({ page }) => {
    await openAppFixture(page)
    await selectSwissPoster(page)
    await page.locator('.ambient-option-control').selectOption('cobalt')
    await page.locator('.cm-lineNumbers .cm-gutterElement').filter({ hasText: /^1$/ }).click()
    await expect(page.locator('.cm-highlighted-line')).toHaveCount(1)

    const result = await page.evaluate(
      (frameWidth) => window.exportCurrentFrame(frameWidth),
      width,
    )

    expect(result.mimeType).toBe('image/png')
    expect(result.blobSize).toBeGreaterThan(20_000)
    expect(result.width).toBe(width * 2)
    expect(result.height).toBeGreaterThan(500)
    expect(result.pixels.ground).toBeGreaterThan(1_000)
    expect(result.pixels.highlight, result.liveColors.highlight).toBeGreaterThan(100)
    expect(result.pixels.keyword).toBeGreaterThan(5)
  })
}
