import { test, expect } from '@playwright/test';

test.describe('Settings page on production', () => {
  test('login and open settings page - no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => { errors.push(err.message); console.error('PAGE ERROR:', err.message); });
    page.on('console', msg => {
      if (msg.type() === 'error') { errors.push(msg.text()); console.error('CONSOLE ERROR:', msg.text()); }
    });

    await page.goto('https://lms-admin-xi-seven.vercel.app/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.fill('input[type="text"]', 'admin@lms.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');
    await page.waitForTimeout(3000);

    await page.goto('https://lms-admin-xi-seven.vercel.app/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(8000);
    await page.screenshot({ path: 'settings-page.png', fullPage: true });

    console.log('All console/page errors:', JSON.stringify(errors));
    expect(errors.length).toBe(0);
  });
});
