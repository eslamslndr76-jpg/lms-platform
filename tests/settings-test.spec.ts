import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './config';

// Runs against the local admin-ui (port 3002) started by playwright.config.ts.
// No production dependency: set ADMIN_UI_URL to point it elsewhere.
test.describe('Admin UI — settings page', () => {
  test('login and open settings page without console/page errors', async ({ page }) => {
    const errors: string[] = [];
    const IGNORED = [/favicon/i, /Download the React DevTools/i, /_next\/static.*sourcemap/i, /Failed to fetch RSC payload/i];

    page.on('pageerror', (err) => {
      if (IGNORED.some((re) => re.test(err.message))) return;
      errors.push(err.message);
      console.error('PAGE ERROR:', err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const loc = msg.location();
      const text = `${msg.text()}${loc?.url ? ` @ ${loc.url}` : ''}`;
      if (IGNORED.some((re) => re.test(text))) return;
      errors.push(text);
      console.error('CONSOLE ERROR:', text);
    });
    // Attach the failing URL to generic "Failed to load resource" messages.
    page.on('response', (res) => {
      if (res.status() >= 400) console.error('HTTP', res.status(), res.url());
    });

    await page.goto('/login');
    await page.fill('input[type="text"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto('/settings');
    await expect(page.locator('h1:has-text("الإعدادات")')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: 'settings-page.png', fullPage: true });

    expect(errors, `Console/page errors: ${JSON.stringify(errors, null, 2)}`).toHaveLength(0);
  });
});
