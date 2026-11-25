import { defineConfig } from '@playwright/test';

// Runs one Playwright workflow against Browserless managed browsers instead of a
// local Chromium. Docs: https://docs.browserless.io/baas/quick-start
const BROWSERLESS_ENDPOINT =
  process.env.BROWSERLESS_ENDPOINT || 'wss://production-sfo.browserless.io';
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN || '';

if (!BROWSERLESS_TOKEN) {
  throw new Error('BROWSERLESS_TOKEN is not set. Add it to the environment (see .env.example).');
}

export default defineConfig({
  testDir: './tests/browserless',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    // Native Playwright protocol connection to a managed browser.
    connectOptions: {
      wsEndpoint: `${BROWSERLESS_ENDPOINT}/chromium/playwright?token=${encodeURIComponent(
        BROWSERLESS_TOKEN,
      )}`,
    },
    trace: 'retain-on-failure',
  },
});
