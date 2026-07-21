import { expect, test, type Page } from '@playwright/test'

const openApp = async (page: Page) => {
  await page.goto('/tests/browser/app.fixture.html')
  await expect(page.locator('.cm-editor')).toBeVisible()
}

const createAmbient = async (page: Page, name = 'Signal study') => page.evaluate(async (ambientName) => {
  window.ambientWorkspaceService.signIn()
  const id = await window.ambientWorkspaceService.createAmbient(ambientName)
  if (!id) throw new Error('Ambient was not created')
  window.ambientWorkspaceService.closeWorkspace()
  return id
}, name)

const openAmbientPicker = async (page: Page) => {
  await page.locator('.ambient-current').click()
  await expect(page.getByRole('grid', { name: 'Choose ambient' })).toBeVisible()
}

const openAmbientLibraryPage = async (page: Page) => {
  await page.locator('.account-menu summary').click()
  await page.getByRole('button', { name: /Your ambients/ }).click()
  await expect(page.getByRole('heading', { name: 'Your ambients' })).toBeVisible()
}

const openWorkspaceFromLibrary = async (page: Page, ambientName: string) => {
  await openAmbientLibraryPage(page)
  const row = page.locator('.ambient-library-row').filter({ hasText: ambientName })
  await row.getByRole('button', { name: 'Edit' }).click()
  await expect(page.locator('.workspace-ambient-identity')).toContainText(ambientName)
  await expect(page.locator('.subpage-header .account-menu')).toBeVisible()
}

test('keeps included ambients in a two-column grid', async ({ page }) => {
  await openApp(page)
  await openAmbientPicker(page)

  const first = await page.getByRole('gridcell', { name: 'macOS window' }).boundingBox()
  const second = await page.getByRole('gridcell', { name: 'Technical plate' }).boundingBox()
  const third = await page.getByRole('gridcell', { name: 'Specimen card' }).boundingBox()

  expect(Math.abs((first?.y ?? 0) - (second?.y ?? 0))).toBeLessThan(2)
  expect(third?.y).toBeGreaterThan(first?.y ?? 0)
})

test('moves vertically between included grid rows', async ({ page }) => {
  await openApp(page)
  await openAmbientPicker(page)
  await page.getByRole('grid', { name: 'Choose ambient' }).press('ArrowDown')
  await page.getByRole('grid', { name: 'Choose ambient' }).press('Enter')

  await expect(page.locator('.ambient-current')).toContainText('Specimen card')
})

test('keeps an unsaved working draft out of the screenshot editor', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)

  await expect(page.locator('.ambient-current')).toContainText('macOS window')
  await openAmbientPicker(page)
  await expect(page.getByRole('gridcell', { name: /Signal study/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  await openAmbientLibraryPage(page)
  const row = page.locator('.ambient-library-row').filter({ hasText: 'Signal study' })
  await expect(row).toContainText('Not saved yet')
  await expect(row).toContainText('Working draft')
  await expect(row.getByRole('button', { name: 'Edit' })).toBeVisible()
})

test('restores the screenshot composition after a full-page authentication redirect', async ({ page }) => {
  await openApp(page)
  await openAmbientPicker(page)
  await page.getByRole('gridcell', { name: 'Technical plate' }).click()
  await page.getByLabel('File type').selectOption('python')
  await page.getByLabel('Title').fill('Preserved composition')
  await page.getByRole('separator', { name: 'Frame width' }).press('ArrowLeft')
  await page.getByText('Highlights', { exact: true }).click()
  await page.getByRole('button', { name: 'Highlight current line' }).click()
  await expect(page.locator('.cm-highlighted-line')).toHaveCount(1)

  const editor = await page.locator('.cm-content').boundingBox()
  if (!editor) throw new Error('Missing code editor')
  await page.getByRole('button', { name: 'Draw' }).click()
  await page.mouse.move(editor.x + editor.width / 2, editor.y + editor.height / 2)
  await page.mouse.down()
  await page.mouse.move(editor.x + editor.width / 2 + 70, editor.y + editor.height / 2 + 30, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.draw-layer path')).toHaveCount(1)

  await page.reload()
  await expect(page.locator('.cm-editor')).toBeVisible()
  await expect(page.locator('.ambient-current')).toContainText('Technical plate')
  await expect(page.getByLabel('File type')).toHaveValue('python')
  await expect(page.getByLabel('Title')).toHaveValue('Preserved composition')
  await expect(page.getByRole('separator', { name: 'Frame width' })).toHaveAttribute('aria-valuenow', '840')
  await expect(page.locator('.cm-highlighted-line')).toHaveCount(1)
  await expect(page.locator('.draw-layer path')).toHaveCount(1)
})

test('creates an ambient in a dedicated workspace', async ({ page }) => {
  await openApp(page)
  await openAmbientPicker(page)
  await page.getByLabel('Your ambients account').getByRole('button', { name: 'Create your own ambient' }).click()

  await expect(page.getByRole('heading', { name: 'Name your ambient' })).toBeVisible()
  await page.getByLabel('Ambient name').fill('Launch frame')
  await page.getByRole('button', { name: 'Create ambient' }).click()

  await expect(page.locator('.workspace-ambient-identity')).toContainText('Launch frame')
  await expect(page).toHaveTitle('Launch frame workspace | codeshot.dev')
  await expect(page.locator('.workspace-preview-frame .cm-editor')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Agent prompt' })).toBeVisible()
  await expect(page.locator('.agent-dock')).toHaveCount(0)

  await page.getByText('Show prompt', { exact: true }).click()
  await expect(page.locator('.workspace-prompt-disclosure pre'))
    .toContainText('Create a codeshot.dev ambient for "Launch frame"')
  const promptContainment = await page.evaluate(() => {
    const sidebar = document.querySelector('.workspace-sidebar')?.getBoundingClientRect()
    const card = document.querySelector('.workspace-prompt-card')?.getBoundingClientRect()
    const prompt = document.querySelector('.workspace-prompt-disclosure pre')?.getBoundingClientRect()
    return {
      cardRight: card?.right ?? 0,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      promptRight: prompt?.right ?? 0,
      sidebarRight: sidebar?.right ?? 0,
    }
  })
  expect(promptContainment.cardRight).toBeLessThanOrEqual(promptContainment.sidebarRight + 1)
  expect(promptContainment.promptRight).toBeLessThanOrEqual(promptContainment.sidebarRight + 1)
  expect(promptContainment.pageOverflow).toBe(0)
})

test('reviews an agent change and saves an immutable version', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  await page.getByRole('button', { name: 'Create agent access' }).click()
  await expect(page.getByRole('heading', { name: 'Agent prompt' })).toBeVisible()
  await page.getByRole('button', { name: 'Copy prompt' }).click()
  await expect(page.getByRole('status')).toContainText(/Agent prompt copied|Ready to review/)
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await expect(page.getByText('Ready to review', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('status')).toContainText('Version 1 saved and now in use')
  await expect(page.getByRole('button', { name: 'Save version' })).toHaveCount(0)
  await page.getByRole('tab', { name: /Versions/ }).click()
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible()
  await expect(page.getByText('In use', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Version 1/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft and Version 1' })).toBeVisible()
  await page.getByRole('button', { name: /Working draft/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft and Version 1' })).toHaveCount(0)
  await expect(page.locator('.workspace-ambient-identity')).toContainText('Working draft')

  await page.getByRole('button', { name: 'Your ambients' }).click()
  await expect(page.getByRole('heading', { name: 'Your ambients' })).toBeVisible()
  await page.getByRole('button', { name: 'Back to editor' }).click()
  await expect(page.locator('.cm-editor')).toBeVisible()
  await openAmbientPicker(page)
  await page.getByRole('gridcell', { name: /Signal study/ }).click()
  await expect(page.locator('.ambient-current')).toContainText('Signal study')
})

test('retains multiple unfinished ambient drafts', async ({ page }) => {
  await openApp(page)
  const firstId = await createAmbient(page, 'First frame')
  const secondId = await page.evaluate(async () => {
    const id = await window.ambientWorkspaceService.createAmbient('Second frame')
    window.ambientWorkspaceService.closeWorkspace()
    return id
  })

  expect(firstId).not.toBe(secondId)
  await openAmbientLibraryPage(page)
  await expect(page.locator('.ambient-library-row').filter({ hasText: 'First frame' })).toContainText('Working draft')
  await expect(page.locator('.ambient-library-row').filter({ hasText: 'Second frame' })).toContainText('Working draft')
})

test('ends agent access without discarding the draft', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')
  await page.getByRole('button', { name: 'Create agent access' }).click()
  await page.getByRole('button', { name: 'End agent access' }).click()

  await expect(page.getByText('Access ended', { exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Your draft is safe')
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft !== null,
  )).toBe(true)
})

test('uses context-specific discard copy for a never-saved ambient', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')
  await page.getByRole('button', { name: 'Discard ambient' }).click()

  await expect(page.getByRole('heading', { name: 'Discard this ambient?' })).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('This ambient has never been saved')
  await page.getByRole('dialog').getByRole('button', { name: 'Discard ambient' }).click()
  await expect(page.getByRole('heading', { name: 'No ambients yet' })).toBeVisible()
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().ownedAmbients.length,
  )).toBe(0)
})

test('restores an older version into a new working draft', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')
  await page.getByRole('button', { name: 'Create agent access' }).click()
  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('status')).toContainText('Version 1 saved')

  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('status')).toContainText('Version 2 saved')

  await page.getByRole('tab', { name: /Versions/ }).click()
  await page.getByRole('button', { name: /Version 1/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft and Version 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Start draft from Version 1' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Start from Version 1' }).click()
  await expect(page.getByRole('status')).toContainText('Working draft started from Version 1')
  await expect(page.getByText('Version 2', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Work' }).click()
  await expect(page.getByText('Ready to review', { exact: true })).toBeVisible()
  await expect(page.getByText(/From Version 1/)).toBeVisible()
  await expect(page.getByText('Access ended', { exact: true })).toBeVisible()
})

test('starts a new draft from the version in use after discarding changes', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')
  await page.getByRole('button', { name: 'Create agent access' }).click()
  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('status')).toContainText('Version 1 saved')

  await page.getByRole('button', { name: 'Discard changes' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(page.getByRole('button', { name: 'Discard changes' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'No active draft' })).toBeVisible()
  await expect(page.locator('.workspace-ambient-identity')).toContainText('Current version')
  await expect(page.locator('.workspace-preview-frame .cm-editor')).toBeVisible()

  await page.getByRole('button', { name: 'Start editing' }).click()
  await expect(page.getByRole('status')).toContainText('New draft started from Version 1')
  await expect(page.getByRole('heading', { name: 'Agent prompt' })).toBeVisible()
  await expect(page.locator('.workspace-ambient-identity')).toContainText('Working draft')

  await page.getByText('Show prompt', { exact: true }).click()
  await expect(page.locator('.workspace-prompt-disclosure pre'))
    .toContainText('Update the codeshot.dev ambient "Signal study"')
})

test('keeps the preview visible while switching Work and Versions on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  const workTab = page.getByRole('tab', { name: 'Work' })
  const versionsTab = page.getByRole('tab', { name: /Versions/ })
  await expect(workTab).toHaveAttribute('aria-selected', 'true')
  await versionsTab.click()
  await expect(versionsTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Saved checkpoints' })).toBeVisible()
  await expect(page.locator('.workspace-preview-frame')).toBeVisible()
  await versionsTab.press('ArrowLeft')
  await expect(workTab).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('button', { name: 'Create agent access' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('account navigation opens the ambient library and logs out private state', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)

  await openAmbientLibraryPage(page)
  await expect(page.locator('.ambient-library-row').filter({ hasText: 'Signal study' })).toBeVisible()

  await page.getByRole('button', { name: 'Back to editor' }).click()
  await expect(page.locator('.cm-editor')).toBeVisible()
  await page.locator('.account-menu summary').click()
  await page.getByRole('button', { name: 'Log out' }).click()

  await openAmbientPicker(page)
  await expect(page.getByRole('rowgroup', { name: 'Your ambients' })).toHaveCount(0)
  await expect(page.getByLabel('Your ambients account').getByRole('button', { name: 'Create your own ambient' })).toBeVisible()
})

test('manages ambients from the library page', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)

  await openAmbientPicker(page)
  await page.getByRole('button', { name: 'Manage your ambients' }).click()
  await expect(page.getByRole('heading', { name: 'Your ambients' })).toBeVisible()

  const row = page.locator('.ambient-library-row').filter({ hasText: 'Signal study' })
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: 'Delete Signal study?' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete ambient' }).click()

  await expect(page.getByRole('heading', { name: 'No ambients yet' })).toBeVisible()
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().ownedAmbients.length,
  )).toBe(0)

  await page.getByRole('button', { name: 'Create your first ambient' }).click()
  await expect(page.getByRole('heading', { name: 'Name your ambient' })).toBeVisible()
})

test('ambient picker closes from account controls', async ({ page }) => {
  await openApp(page)
  const trigger = page.locator('.ambient-current')

  await trigger.click()
  const createAmbient = page.getByRole('region', { name: 'Your ambients account' })
    .getByRole('button', { name: 'Create your own ambient' })
  await createAmbient.focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await createAmbient.focus()
  await page.keyboard.press('Tab')
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)
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
  const [statusBox, toolbarAfter] = await Promise.all([status.boundingBox(), toolbar.boundingBox()])

  expect(statusBox).not.toBeNull()
  expect(statusBox!.y).toBeGreaterThanOrEqual(0)
  expect(statusBox!.y + statusBox!.height).toBeLessThanOrEqual(844)
  expect(toolbarAfter?.height).toBe(toolbarBefore?.height)
})
