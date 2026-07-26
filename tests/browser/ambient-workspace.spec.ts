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

const createSavedAmbient = async (page: Page, name = 'Signal study') => page.evaluate(async (ambientName) => {
  window.ambientWorkspaceService.signIn()
  const id = await window.ambientWorkspaceService.createAmbient(ambientName)
  if (!id) throw new Error('Ambient was not created')
  const version = await window.ambientWorkspaceService.saveAmbientVersion()
  if (!version) throw new Error('Ambient version was not saved')
  window.ambientWorkspaceService.closeWorkspace()
  return id
}, name)

const openAmbientPicker = async (page: Page) => {
  await page.locator('.ambient-current').click()
  await expect(page.getByRole('grid', { name: 'Choose theme' })).toBeVisible()
}

const openAmbientLibraryPage = async (page: Page) => {
  await page.locator('.account-menu-trigger').click()
  await page.getByRole('menuitem', { name: /Your themes/ }).click()
  await expect(page.getByRole('heading', { name: 'Your themes' })).toBeVisible()
}

const openWorkspaceFromLibrary = async (page: Page, ambientName: string) => {
  await openAmbientLibraryPage(page)
  const row = page.locator('.ambient-library-row').filter({ hasText: ambientName })
  await row.getByRole('button', { name: 'Edit' }).click()
  await expect(page.locator('.workspace-ambient-identity')).toContainText(ambientName)
  await expect(page.locator('.subpage-header .account-menu-trigger')).toBeVisible()
}

test('toggles the ambient picker closed from its trigger', async ({ page }) => {
  await openApp(page)
  await openAmbientPicker(page)

  await page.locator('.ambient-current').click()
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)
})

test('dismisses the create theme suggestion', async ({ page }) => {
  await openApp(page)
  const suggestion = page.getByRole('complementary', { name: 'Create your own theme' })

  await expect(suggestion).toBeVisible()
  await suggestion.getByRole('button', { name: 'Dismiss create theme suggestion' }).click()
  await expect(suggestion).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.cm-editor')).toBeVisible()
  await expect(suggestion).toHaveCount(0)
})

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
  await page.getByRole('grid', { name: 'Choose theme' }).press('ArrowDown')
  await page.getByRole('grid', { name: 'Choose theme' }).press('Enter')

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

test('opens a shared theme directly in the editor', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html?shared-ambient')
  await expect(page.locator('.cm-editor')).toBeVisible()
  await expect(page.locator('.ambient-shared-current')).toContainText('Swiss poster')
  await expect(page.getByText('Shared theme', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exit shared theme and open editor' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Swiss poster/ })).toHaveCount(0)
})

test('hides link sharing until an ambient has a saved version', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  await expect(page.getByRole('button', { name: 'Share theme' })).toHaveCount(0)
})

test('reuses the same link after link sharing is turned off and on', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)
  await createSavedAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  await page.getByRole('button', { name: 'Share' }).click()
  await page.getByRole('button', { name: 'Enable link sharing' }).click()
  await expect(page.getByText('Anyone with the link', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeFocused()
  await page.getByRole('button', { name: 'Copy link' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  await expect(page.locator('.app-toast')).toHaveCount(0)
  const firstLink = await page.evaluate(() => navigator.clipboard.readText())

  await page.getByRole('button', { name: 'Turn off link sharing' }).click()
  await expect(page.getByText('Private', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enable link sharing' })).toBeFocused()
  await page.getByRole('button', { name: 'Enable link sharing' }).click()
  await page.getByRole('button', { name: 'Copy link' }).click()
  const secondLink = await page.evaluate(() => navigator.clipboard.readText())

  expect(secondLink).toBe(firstLink)
  expect(secondLink).toContain('/a/share-ambient-mock-1-token/signal-study-mock')
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

  await page.getByRole('button', { name: 'Draw' }).click()
  const editor = await page.locator('.cm-content').boundingBox()
  if (!editor) throw new Error('Missing code editor')
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

test('creates a theme without an account and opens it straight away', async ({ page }) => {
  await openApp(page)
  await page.getByRole('button', { name: 'create a theme' }).click()

  const themeName = 'Custom Theme'
  await expect(page.locator('.workspace-ambient-identity')).toContainText(themeName)
  await expect(page).toHaveTitle(`${themeName} workspace | codeshot.dev`)
  await expect(page.locator('.workspace-preview-frame .cm-editor')).toBeVisible()

  await expect(page.locator('.workspace-unsaved-chip')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'codeshot.dev', exact: true })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Agent prompt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy prompt' })).toBeVisible()
  await expect(page.locator('.agent-dock')).toHaveCount(0)

  await expect(page.locator('.workspace-prompt-text'))
    .toContainText(`Create a codeshot.dev theme for "${themeName}"`)
  const promptContainment = await page.evaluate(() => {
    const sidebar = document.querySelector('.workspace-sidebar')?.getBoundingClientRect()
    const card = document.querySelector('.workspace-prompt-card')?.getBoundingClientRect()
    const prompt = document.querySelector('.workspace-prompt-text')?.getBoundingClientRect()
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

test('asks a guest to sign in only once the agent has delivered work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)
  await page.getByRole('button', { name: 'create a theme' }).click()
  await expect(page.getByRole('button', { name: /Rename theme/ })).toBeVisible()

  // Nothing asks for an account while the agent is being handed the prompt.
  await expect(page.getByRole('button', { name: 'Sign in and save' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Copy prompt' }).click()
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)

  // Saving is the first and only moment signing in is required.
  await expect(page.getByRole('button', { name: 'Sign in and save' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save version' })).toHaveCount(0)
  await expect(page.locator('.workspace-unsaved-chip')).toHaveCount(0)

  await page.evaluate(async () => {
    window.ambientWorkspaceService.signIn()
    await window.ambientWorkspaceService.claimGuestWork()
  })
  await expect(page.locator('.workspace-unsaved-chip')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save version' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in and save' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('button', { name: 'Save version' })).toHaveCount(0)
})

test('renames a theme from the workspace preview', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  await page.getByRole('button', { name: /Rename theme/ }).click()
  const nameField = page.getByLabel('Theme name', { exact: true })
  await nameField.fill('Launch frame')
  await nameField.press('Enter')

  await expect(page.locator('.workspace-ambient-identity')).toContainText('Launch frame')
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(0)
})

test('reviews an agent change and saves an immutable version', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  await page.getByRole('button', { name: 'Create agent access' }).click()
  await expect(page.getByRole('heading', { name: 'Agent prompt' })).toBeVisible()
  await page.getByRole('button', { name: 'Copy prompt' }).click()
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible()
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await expect(page.getByRole('heading', { name: 'Review the working draft' })).toBeVisible()
  const promptUtility = page.getByText('Agent prompt', { exact: true })
  await expect(promptUtility).toBeVisible()
  await promptUtility.click()
  await expect(page.getByRole('button', { name: 'Copy prompt' })).toHaveClass(/ui-button-primary/)

  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('button', { name: 'Save version' })).toHaveCount(0)
  await expect(page.locator('.app-toast')).toHaveCount(0)
  await page.getByRole('tab', { name: /Versions/ }).click()
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible()
  await expect(page.getByText('In use', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Version 1/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft and Version 1' })).toBeVisible()
  await page.getByRole('button', { name: /Working draft/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft and Version 1' })).toHaveCount(0)
  await expect(page.locator('.workspace-ambient-identity')).toContainText('Working draft')

  await page.getByRole('button', { name: 'Your themes' }).click()
  await expect(page.getByRole('heading', { name: 'Your themes' })).toBeVisible()
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
  await page.getByRole('button', { name: 'End access' }).click()

  await expect(page.getByRole('heading', { name: 'Prepare the agent prompt' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create agent access' })).toBeVisible()
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft !== null,
  )).toBe(true)
})

test('uses context-specific discard copy for a never-saved theme', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')
  await page.getByRole('button', { name: 'Discard theme' }).click()

  await expect(page.getByRole('heading', { name: 'Discard this theme?' })).toBeVisible()
  await expect(page.getByRole('alertdialog')).toContainText('This theme has never been saved')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard theme' }).click()
  await expect(page.getByRole('heading', { name: 'No themes yet' })).toBeVisible()
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
  await expect(page.getByRole('tab', { name: /Versions 1/ })).toBeVisible()

  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('tab', { name: /Versions 2/ })).toBeVisible()

  await page.getByRole('tab', { name: /Versions/ }).click()
  await page.getByRole('button', { name: /Version 1/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft and Version 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Start draft from Version 1' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Start from Version 1' }).click()
  await expect(page.getByText('Version 2', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Work' }).click()
  await expect(page.getByRole('heading', { name: 'Review the working draft' })).toBeVisible()
  await expect(page.getByText('Started from Version 1', { exact: true })).toBeVisible()
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
  await expect(page.getByRole('tab', { name: /Versions 1/ })).toBeVisible()

  await page.getByRole('button', { name: 'Close draft' }).click()
  await expect(page.getByRole('heading', { name: 'Close the working draft?' })).toBeVisible()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Close draft' }).click()
  await expect(page.getByRole('button', { name: 'Close draft' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Version 1 is in use' })).toBeVisible()
  await expect(page.locator('.workspace-ambient-identity')).toContainText('Current version')
  await expect(page.locator('.workspace-preview-frame .cm-editor')).toBeVisible()

  await page.getByRole('button', { name: 'Start another update' }).click()
  await expect(page.getByRole('heading', { name: 'Update this theme' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Update this theme' }).getByRole('button', { name: 'Copy prompt' }))
    .toHaveClass(/ui-button-primary/)
  await expect(page.locator('.workspace-ambient-identity')).toContainText('Working draft')

  await expect(page.locator('.workspace-prompt-text'))
    .toContainText('Update the codeshot.dev theme "Signal study"')
})

test('previews customization options without persisting them', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')
  await page.getByRole('button', { name: 'Create agent access' }).click()
  await expect(page.getByRole('group', { name: 'Preview customizations' })).toHaveCount(0)

  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)

  const strip = page.getByRole('group', { name: 'Preview customizations' })
  const frameCanvas = () => page.evaluate(
    () => document.querySelector<HTMLElement>('.workspace-preview-frame')?.style.getPropertyValue('--ambient-canvas'),
  )
  await expect(strip).toBeVisible()
  await expect(page.locator('.workspace-preview-help')).toContainText('preview-only')
  await expect(strip.getByRole('button', { name: 'Reset' })).toBeDisabled()
  await expect.poll(frameCanvas).toBe('oklch(0.96 0.006 250)')

  await strip.getByLabel('Canvas').selectOption('frost')
  await expect.poll(frameCanvas).toBe('oklch(0.9 0.03 250)')
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.document.customizations[0],
  )).toMatchObject({ defaultOptionId: 'paper' })

  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(2)
  await expect(strip.getByLabel('Canvas')).toHaveValue('frost')
  await expect.poll(frameCanvas).toBe('oklch(0.9 0.03 250)')

  await strip.getByRole('button', { name: 'Reset' }).click()
  await expect.poll(frameCanvas).toBe('oklch(0.96 0.006 250)')
  await expect(strip.getByRole('button', { name: 'Reset' })).toBeDisabled()
})

test('customizes each comparison pane independently', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')
  await page.getByRole('button', { name: 'Create agent access' }).click()
  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await page.getByRole('button', { name: 'Save version' }).click()
  await expect(page.getByRole('tab', { name: /Versions 1/ })).toBeVisible()

  await page.evaluate(() => window.ambientWorkspaceService.copyPrompt())
  await expect.poll(() => page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().workspace?.workingDraft?.acceptedChangeCount,
  )).toBe(1)
  await page.getByRole('tab', { name: /Versions/ }).click()
  await page.getByRole('button', { name: /Version 1/ }).click()
  await expect(page.getByRole('heading', { name: 'Draft and Version 1' })).toBeVisible()

  const paneCanvasValues = () => page.evaluate(
    () => [...document.querySelectorAll<HTMLElement>('.draft-comparison-grid .workspace-preview-frame')]
      .map((frame) => frame.style.getPropertyValue('--ambient-canvas')),
  )
  await page.getByRole('group', { name: 'Draft customizations' }).getByLabel('Canvas').selectOption('moss')
  await expect.poll(paneCanvasValues).toEqual(['oklch(0.88 0.05 150)', 'oklch(0.96 0.006 250)'])

  await page.getByRole('group', { name: 'Version customizations' }).getByLabel('Canvas').selectOption('frost')
  await expect.poll(paneCanvasValues).toEqual(['oklch(0.88 0.05 150)', 'oklch(0.9 0.03 250)'])
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

test('collapses and expands the workspace sidebar', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  const layout = page.locator('.workspace-layout')
  const sidebarToggle = page.locator('.workspace-sidebar-toggle')
  const collapseButton = page.getByRole('button', { name: 'Collapse sidebar' })
  const expandButton = page.getByRole('button', { name: 'Expand sidebar' })
  const panelWidth = async () => (await page.locator('.workspace-activity-panel').boundingBox())?.width ?? 0
  const iconCenter = async () => sidebarToggle.locator('svg').evaluate((icon) => {
    const bounds = icon.getBoundingClientRect()
    return {
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    }
  })
  const storedCollapsed = () => page.evaluate(
    () => window.localStorage.getItem('codeshot.workspace-sidebar-collapsed'),
  )

  await expect(layout).toHaveAttribute('data-sidebar', 'expanded')
  await expect(collapseButton).toBeVisible()
  const expandedIconCenter = await iconCenter()

  await collapseButton.click()
  await expect(layout).toHaveAttribute('data-sidebar', 'collapsed')
  await expect(expandButton).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Work' })).toBeHidden()
  await expect.poll(panelWidth).toBeLessThan(60)
  await expect.poll(storedCollapsed).toBe('true')
  await expect(expandButton).toBeFocused()
  await expect.poll(async () => (await iconCenter()).x).toBeCloseTo(expandedIconCenter.x, 1)
  await expect.poll(async () => (await iconCenter()).y).toBeCloseTo(expandedIconCenter.y, 1)

  await expandButton.click()
  await expect(layout).toHaveAttribute('data-sidebar', 'expanded')
  await expect(collapseButton).toBeFocused()
  await expect.poll(panelWidth).toBeGreaterThan(300)
  await expect.poll(storedCollapsed).toBe('false')
})

test('keeps the sidebar expanded on mobile regardless of preference', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('codeshot.workspace-sidebar-collapsed', 'true')
    } catch {
      // Ignore storage failures in the test harness.
    }
  })
  await page.setViewportSize({ width: 600, height: 844 })
  await openApp(page)
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeHidden()
  await expect(page.getByRole('tab', { name: 'Work' })).toBeVisible()
})

test('account navigation opens the ambient library and logs out private state', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)

  await openAmbientLibraryPage(page)
  await expect(page.locator('.ambient-library-row').filter({ hasText: 'Signal study' })).toBeVisible()

  await page.getByRole('button', { name: 'Back to editor' }).click()
  await expect(page.locator('.cm-editor')).toBeVisible()
  await page.locator('.account-menu-trigger').click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()

  await openAmbientPicker(page)
  await expect(page.getByRole('rowgroup', { name: 'Your themes' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'create a theme' })).toBeVisible()
})

test('does not show a missing ambient while returning to the library', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html?delayed-navigation')
  await expect(page.locator('.cm-editor')).toBeVisible()
  await createAmbient(page)
  await openWorkspaceFromLibrary(page, 'Signal study')

  await page.evaluate(() => {
    window.ambientNotFoundSeen = false
    const observer = new MutationObserver(() => {
      if (document.body.textContent?.includes('Theme not found')) {
        window.ambientNotFoundSeen = true
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
  })
  await page.getByRole('button', { name: 'Your themes' }).click()
  await expect(page.getByRole('heading', { name: 'Your themes' })).toBeVisible()

  expect(await page.evaluate(() => window.ambientNotFoundSeen)).toBe(false)
})

test('shows not found after a workspace load confirms the ambient is missing', async ({ page }) => {
  await page.goto('/tests/browser/app.fixture.html?workspace=missing&existing-draft')

  await expect(page.getByRole('heading', { name: 'Theme not found' })).toBeVisible()
})

test('manages themes from the library page', async ({ page }) => {
  await openApp(page)
  await createAmbient(page)

  await openAmbientLibraryPage(page)

  const row = page.locator('.ambient-library-row').filter({ hasText: 'Signal study' })
  await row.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: 'Delete Signal study?' })).toBeVisible()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete theme' }).click()

  await expect(page.getByRole('heading', { name: 'No themes yet' })).toBeVisible()
  expect(await page.evaluate(
    () => window.ambientWorkspaceService.getSnapshot().ownedAmbients.length,
  )).toBe(0)

  await page.getByRole('button', { name: 'Create your first theme' }).click()
  await expect(page.getByRole('button', { name: /Rename theme/ })).toBeVisible()
})

test('ambient picker closes when keyboard focus leaves it', async ({ page }) => {
  await openApp(page)
  const trigger = page.locator('.ambient-current')

  await trigger.click()
  await page.getByRole('grid', { name: 'Choose theme' }).focus()
  await page.keyboard.press('Escape')
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)
  await expect(trigger).toBeFocused()

  await trigger.click()
  await page.getByRole('grid', { name: 'Choose theme' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Create theme', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.locator('.ambient-picker-shell')).toHaveCount(0)
})

test('mobile copy feedback stays in the button without resizing the toolbar', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 390, height: 844 })
  await openApp(page)

  const toolbar = page.locator('.shot-toolbar')
  const copyButton = page.getByRole('button', { name: 'Copy PNG' })
  const [toolbarBefore, buttonBefore] = await Promise.all([toolbar.boundingBox(), copyButton.boundingBox()])
  await copyButton.click()
  const copiedButton = page.getByRole('button', { name: 'Copied' })
  await expect(copiedButton).toBeVisible()
  const [toolbarAfter, buttonAfter] = await Promise.all([toolbar.boundingBox(), copiedButton.boundingBox()])

  await expect(page.locator('.app-toast')).toHaveCount(0)
  expect(buttonAfter?.width).toBe(buttonBefore?.width)
  expect(toolbarAfter?.height).toBe(toolbarBefore?.height)
})
