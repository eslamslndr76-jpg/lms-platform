import { defineConfig } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const USER_UI_URL = process.env.USER_UI_URL || 'http://localhost:3000';
const ADMIN_UI_URL = process.env.ADMIN_UI_URL || 'http://localhost:3002';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: API_URL,
    // Use the full Chromium build (already installed) instead of requiring the
    // separate `chromium_headless_shell` download.
    channel: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npx tsx --env-file-if-exists=.env.local src/index.ts',
      url: `${API_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      cwd: './backend',
      timeout: 120_000,
    },
    {
      command: 'npx next dev -p 3000',
      url: USER_UI_URL,
      reuseExistingServer: !process.env.CI,
      cwd: './user-ui',
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: API_URL },
    },
    {
      command: 'npx next dev -p 3002',
      url: ADMIN_UI_URL,
      reuseExistingServer: !process.env.CI,
      cwd: './admin-ui',
      timeout: 180_000,
      env: { NEXT_PUBLIC_API_URL: API_URL },
    },
  ],
  projects: [
    {
      name: 'api',
      testMatch: /(backend-api|admin-api|exports|places|notifications-api|group-completion-api)\.spec\.ts$/,
      use: { baseURL: API_URL },
    },
    {
      name: 'user-ui',
      testMatch: /(user-ui|notifications-ui)\.spec\.ts$/,
      use: { baseURL: USER_UI_URL },
    },
    {
      name: 'admin-ui',
      testMatch: /(settings-test|permissions-ui|group-completion-ui)\.spec\.ts$/,
      use: { baseURL: ADMIN_UI_URL },
    },
  ],
});
