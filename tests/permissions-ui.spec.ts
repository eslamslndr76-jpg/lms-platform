import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './config';

// Runs against the local admin-ui (port 3002) started by playwright.config.ts.
test.describe('Admin UI — users & permissions module', () => {
  test('login, browse the three tabs, and keep the old route working', async ({ page }) => {
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
    page.on('response', (res) => {
      if (res.status() >= 400) console.error('HTTP', res.status(), res.url());
    });

    await page.goto('/login');
    await page.fill('input[type="text"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto('/permissions');
    await expect(page.locator('h1:has-text("المستخدمون والصلاحيات")')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /الحسابات/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /الأدوار والصلاحيات/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /بيانات الدخول/ })).toBeVisible();

    // Roles tab: the permission matrix comes from /api/roles/catalog.
    await page.getByRole('tab', { name: /الأدوار والصلاحيات/ }).click();
    await page.getByRole('button', { name: 'اختيار دور مدير النظام' }).click();
    await expect(page.locator('text=يملك وصولًا كاملًا')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'اختيار دور موظف' }).click();
    await expect(page.locator('text=صلاحيات الدور تُطبق على كل حساب مرتبط به')).toBeVisible();
    await expect(page.getByRole('button', { name: 'حفظ صلاحيات الدور' })).toBeVisible();

    // Login data tab.
    await page.getByRole('tab', { name: /بيانات الدخول/ }).click();
    await expect(page.locator('th:has-text("آخر دخول")')).toBeVisible({ timeout: 20_000 });

    // Legacy route redirects to the new module.
    await page.goto('/employees');
    await expect(page).toHaveURL(/\/permissions$/, { timeout: 20_000 });

    expect(errors, `Console/page errors: ${JSON.stringify(errors, null, 2)}`).toHaveLength(0);
  });
});
