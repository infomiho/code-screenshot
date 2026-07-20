import { expect, test, type Page } from '@playwright/test'

const openApp = async (page: Page) => {
  await page.goto('/tests/browser/app.fixture.html')
  await expect(page.locator('.cm-editor')).toBeVisible()
}

const acceptFirstAgentUpdate = async (page: Page) => {
  await page.evaluate(async () => {
    window.ambientWorkspaceService.signIn()
    window.ambientWorkspaceService.beginAmbient()
    await new Promise(window.requestAnimationFrame)
    window.ambientWorkspaceService.createAmbient('Signal study')
    window.ambientWorkspaceService.copyPrompt()
  })
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().draft?.phase,
  )).toBe('review')
  await expect(page.locator('.ambient-current')).toContainText('Signal study')
}

const saveCurrentVersion = async (page: Page) => {
  await page.evaluate(() => window.ambientWorkspaceService.savePrivateVersion())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().draft?.phase,
  )).toBe('saved')
}

test('keeps built-in ambients in a two-column grid', async ({ page }) => {
  await openApp(page)
  await page.locator('.ambient-current').click()

  const first = await page.getByRole('gridcell', { name: 'macOS window' }).boundingBox()
  const second = await page.getByRole('gridcell', { name: 'Technical plate' }).boundingBox()
  const third = await page.getByRole('gridcell', { name: 'Specimen card' }).boundingBox()

  expect(Math.abs((first?.y ?? 0) - (second?.y ?? 0))).toBeLessThan(2)
  expect(third?.y).toBeGreaterThan(first?.y ?? 0)
  expect(first?.width).toBeLessThan(page.viewportSize()?.width ?? 0)
})

test('moves vertically between built-in grid rows', async ({ page }) => {
  await openApp(page)
  await page.locator('.ambient-current').click()
  await page.getByRole('grid', { name: 'Choose ambient' }).press('ArrowDown')
  await page.getByRole('grid', { name: 'Choose ambient' }).press('Enter')

  await expect(page.locator('.ambient-current')).toContainText('Specimen card')
})

test('reopens a saved session and saves another accepted revision', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)
  await saveCurrentVersion(page)

  await page.locator('.ambient-current').click()
  await page.getByRole('button', { name: 'Open agent session' }).click()
  await expect(page.getByRole('heading', { name: 'Ready-to-paste prompt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Minimize' })).toBeFocused()
  const copyPrompt = page.getByRole('button', { name: 'Copy prompt' })
  await expect(copyPrompt).toBeVisible()
  await copyPrompt.focus()

  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect(page.getByRole('button', { name: 'Save private version' })).toBeVisible()
  await expect(copyPrompt).toBeFocused()
  await expect(page.locator('.ambient-current')).toContainText('Signal study')

  await page.getByRole('button', { name: 'Save private version' }).click()
  await expect(page.getByRole('heading', { name: 'Private version saved' })).toBeVisible()
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().savedAmbients[0]?.version,
  )).toBe(2)
})

test('selects the draft when reopening its agent session', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)
  await saveCurrentVersion(page)

  await page.locator('.ambient-current').click()
  await page.getByRole('gridcell', { name: 'Technical plate' }).click()
  await expect(page.locator('.ambient-current')).toContainText('Technical plate')

  await page.locator('.ambient-current').click()
  await page.getByRole('button', { name: 'Open agent session' }).click()

  await expect(page.locator('.ambient-current')).toContainText('Signal study')
  await expect(page.getByRole('heading', { name: 'Ready-to-paste prompt' })).toBeVisible()
})

test('exits an unsaved agent review without deleting the draft', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)

  await page.locator('.agent-dock-trigger').click()
  await page.getByRole('button', { name: 'Exit edit mode' }).click()

  await expect(page.locator('.agent-dock')).toHaveCount(0)
  await expect(page.locator('.agent-dock-trigger')).toHaveCount(0)
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().draft?.phase,
  )).toBe('review')
  await expect(page.locator('.cm-editor')).toBeVisible()
})

test('keeps a hydrated existing draft hidden until explicitly opened', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html?existing-draft')
  await expect(page.locator('.cm-editor')).toBeVisible()

  await expect(page.locator('.agent-dock-trigger')).toHaveCount(0)
  await expect(page.locator('.agent-dock')).toHaveCount(0)
  await page.locator('.ambient-current').click()
  await page.getByRole('button', { name: 'Open draft' }).click()

  await expect(page.getByRole('heading', { name: 'Ready-to-paste prompt' })).toBeVisible()
  await expect(page.getByText('Agent link unavailable')).toHaveCount(0)
  await expect(page.locator('.agent-prompt pre')).not.toContainText('Generate a new temporary agent link')
})

test('discards an unsaved agent review after confirmation', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)

  await page.locator('.agent-dock-trigger').click()
  await page.getByRole('button', { name: 'Discard draft' }).click()
  await expect(page.getByText('Discard unsaved changes and end agent access?')).toBeVisible()
  await page.getByRole('button', { name: 'Discard', exact: true }).click()

  await expect(page.locator('.agent-dock')).toHaveCount(0)
  await expect(page.locator('.agent-dock-trigger')).toHaveCount(0)
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().draft,
  )).toBeNull()
  await expect(page.locator('.ambient-current')).toContainText('macOS window')
})

test('edits a saved ambient again after its draft is discarded', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)
  await saveCurrentVersion(page)
  await page.evaluate(() => window.ambientWorkspaceService.discardAmbientDraft())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().draft,
  )).toBeNull()

  await page.locator('.ambient-current').click()
  await page.getByRole('button', { name: 'Edit Signal study' }).focus()
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'Send to your agent' })).toBeVisible()
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().draft?.id,
  )).toBe('ambient-mock-1')
})

test('minimizes or exits a saved edit session', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)
  await saveCurrentVersion(page)

  await page.locator('.agent-dock-trigger').click()
  await page.getByRole('button', { name: 'Minimize' }).click()
  await expect(page.locator('.agent-dock-trigger')).toBeVisible()
  await page.locator('.agent-dock-trigger').click()
  await page.getByRole('button', { name: 'Exit edit mode' }).click()

  await expect(page.locator('.agent-dock')).toHaveCount(0)
  await expect(page.locator('.agent-dock-trigger')).toHaveCount(0)
  await expect(page.locator('.cm-editor')).toBeVisible()
})

test('selects the minimal draft as soon as custom design starts', async ({ page }) => {
  await openApp(page)
  await page.evaluate(() => {
    window.ambientWorkspaceService.signIn()
    window.ambientWorkspaceService.beginAmbient()
  })

  await expect(page.locator('.ambient-current')).toContainText('New ambient')
  await expect(page.locator('.declarative-ambient')).toBeVisible()
})

test('later revisions do not steal a built-in selection', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)
  await saveCurrentVersion(page)

  await page.locator('.ambient-current').click()
  await page.getByRole('gridcell', { name: 'Technical plate' }).click()
  await expect(page.locator('.ambient-current')).toContainText('Technical plate')

  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().draft?.revision,
  )).toBe(2)
  await expect(page.locator('.ambient-current')).toContainText('Technical plate')
})

test('logout hides private state and login restores it', async ({ page }) => {
  await openApp(page)
  await acceptFirstAgentUpdate(page)
  await saveCurrentVersion(page)

  await page.locator('.account-menu summary').click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page.locator('.agent-dock-trigger')).toHaveCount(0)

  await page.locator('.ambient-current').click()
  await expect(page.getByRole('gridcell', { name: 'Signal study' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Sign in with GitHub' }).click()
  await page.locator('.ambient-current').click()
  await expect(page.getByRole('gridcell', { name: 'Signal study' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open agent session' })).toBeVisible()
})

test('ambient picker closes from account controls', async ({ page }) => {
  await openApp(page)
  const trigger = page.locator('.ambient-current')

  await trigger.click()
  const signIn = page.getByRole('region', { name: 'Your ambients account' })
    .getByRole('button', { name: 'Sign in with GitHub' })
  await signIn.focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await signIn.focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await trigger.click()
  await page.getByRole('button', { name: 'Close ambient picker' }).click()
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test('mobile export feedback stays visible without resizing the toolbar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)

  const toolbar = page.locator('.shot-toolbar')
  const toolbarBefore = await toolbar.boundingBox()
  await page.getByRole('button', { name: 'Copy PNG' }).click()

  const status = page.locator('#export-status')
  await expect(status).toHaveText(/Copied PNG to clipboard|Copy failed/)
  const [statusBox, toolbarAfter] = await Promise.all([
    status.boundingBox(),
    toolbar.boundingBox(),
  ])

  expect(statusBox).not.toBeNull()
  expect(statusBox!.y).toBeGreaterThanOrEqual(0)
  expect(statusBox!.y + statusBox!.height).toBeLessThanOrEqual(844)
  expect(toolbarAfter?.height).toBe(toolbarBefore?.height)
})
