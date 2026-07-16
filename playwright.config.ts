import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
  },
  webServer: {
    command: 'npx vite --config vite.browser.config.ts',
    url: 'http://127.0.0.1:4173/tests/browser/shadow-export.fixture.html',
    reuseExistingServer: !process.env.CI,
  },
})
