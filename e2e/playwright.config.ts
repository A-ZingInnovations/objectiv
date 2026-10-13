import { defineConfig, devices } from '@playwright/test';

const APP_ORIGIN = process.env.OBJECTIV_E2E_ORIGIN || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list']],
  use: {
    baseURL: APP_ORIGIN,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev --prefix ../app',
    url: `${APP_ORIGIN}/?e2e=explorer`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
