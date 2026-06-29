import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3001',
  },
  webServer: [
    {
      command: 'npx tsx src/index.ts',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: !process.env.CI,
      cwd: './backend',
    },
    {
      command: 'npx next dev -p 3000',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      cwd: './user-ui',
    },
  ],
});
