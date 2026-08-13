import { defineConfig } from '@playwright/test'

const port = process.env.PLAYWRIGHT_PORT ?? '4173'

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
  },
  webServer: {
    command: `npx vite --config vite.browser.config.ts --port ${port}`,
    url: `http://127.0.0.1:${port}/tests/browser/shadow-export.fixture.html`,
    reuseExistingServer: false,
  },
})
