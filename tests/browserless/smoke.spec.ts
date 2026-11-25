import { expect, test } from '@playwright/test';

// Minimal Browserless example: the browser runs on Browserless, not on this machine.
// Run with `npm run test:browserless` once BROWSERLESS_TOKEN is set.
test('loads a public page through Browserless', async ({ page }) => {
  const response = await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Example Domain/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Example Domain');
});
