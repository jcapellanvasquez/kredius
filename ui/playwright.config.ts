import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests at phone and desktop width, against `ng serve` with the API mocked (e2e/support/mock-api.ts),
 * so they need no backend or database. Runs the installed Chrome (`channel: 'chrome'`): no browser download.
 *
 *   npm run e2e              all tests, both projects
 *   npm run e2e -- --project=phone
 *   npm run e2e:report       open the last HTML report (screenshots of each test are attached)
 */
const PORT = 4300; // not 4200, so it doesn't clash with a dev `ng serve`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
