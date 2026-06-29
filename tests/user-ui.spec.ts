import { test, expect } from '@playwright/test';

test.describe('User-UI Mobile-First', () => {
  test('homepage loads with branding', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('navigate to login page', async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await expect(page.locator('button:has-text("دخول")')).toBeVisible();
  });

  test('navigate to register page', async ({ page }) => {
    await page.goto('http://localhost:3000/register');
    await expect(page.locator('button:has-text("إنشاء حساب")')).toBeVisible();
  });

  test('login form works', async ({ page, request }) => {
    const email = `test-${Date.now()}@test.com`;
    const reg = await request.post('http://localhost:3001/api/auth/register', {
      data: { name: 'Test', email, password: 'test123' },
    });
    expect(reg.ok()).toBeTruthy();
    await page.goto('http://localhost:3000/login');
    await page.waitForSelector('input[placeholder="example@email.com"]');
    await page.fill('input[placeholder="example@email.com"]', email);
    await page.fill('input[placeholder="••••••••"]', 'test123');
    await page.click('button:has-text("دخول")');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('course listing shows courses', async ({ page }) => {
    await page.goto('http://localhost:3000/courses');
    await page.waitForSelector('a[href^="/courses/"]');
    const links = page.locator('a[href^="/courses/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
  });
});
