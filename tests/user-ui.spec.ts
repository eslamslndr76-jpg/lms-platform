import { test, expect } from '@playwright/test';
import { API_URL, uniqueEmail, uniquePhone } from './config';

test.describe('User UI', () => {
  test('homepage loads with branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2').first()).toBeVisible();
  });

  test('navigate to login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('button:has-text("دخول")')).toBeVisible();
  });

  test('navigate to register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('button:has-text("التالي")')).toBeVisible();
  });

  test('login form works', async ({ page, request }) => {
    const email = uniqueEmail('login');
    const reg = await request.post(`${API_URL}/api/auth/register`, {
      data: {
        name: 'Test',
        email,
        password: 'test123',
        phone: uniquePhone(),
        nationalId: String(Date.now()).padStart(14, '7').slice(0, 14),
      },
    });
    expect(reg.ok()).toBeTruthy();

    await page.goto('/login');
    const emailInput = page.locator('input[placeholder*="example@email.com"]');
    await emailInput.waitFor();
    await emailInput.fill(email);
    await page.locator('input[type="password"]').fill('test123');
    await page.click('button:has-text("دخول")');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });

  test('course listing shows courses', async ({ page }) => {
    await page.goto('/courses');
    await page.waitForSelector('a[href^="/courses/"]');
    const links = page.locator('a[href^="/courses/"]');
    expect(await links.count()).toBeGreaterThanOrEqual(1);
  });
});
