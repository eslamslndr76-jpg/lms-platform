import { test, expect, APIRequestContext } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_UI_URL,
  API_URL,
  USER_UI_URL,
  uniqueEmail,
} from './config';

/**
 * Phase 2 — notification bell UX (edit-plan.md §4.3).
 *
 * Verifies the full journey in the student UI (badge → panel → open one →
 * mark all) and the non-blocking panel in the admin UI.
 */
test.describe.configure({ serial: true });

test.describe('Notification bell', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const studentPassword = 'Student123!';
  const studentEmail = uniqueEmail('notification-ui');
  let adminToken = '';
  let studentId = 0;

  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });

  const createCourseAndGroup = async (request: APIRequestContext, suffix: string) => {
    const courseRes = await request.post(`${API_URL}/api/courses`, {
      headers: adminAuth(),
      data: {
        title_ar: `كورس جرس ${suffix} ${stamp}`,
        title_en: `Bell Course ${suffix} ${stamp}`,
        course_mode: 'online',
        max_students: 50,
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    const courseId = (await courseRes.json()).id as number;

    const groupRes = await request.post(`${API_URL}/api/groups`, {
      headers: adminAuth(),
      data: {
        course_id: courseId,
        name: `مجموعة جرس ${suffix} ${stamp}`,
        status: 'active',
      },
    });
    expect(groupRes.status()).toBe(201);
    return (await groupRes.json()).id as number;
  };

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.ok()).toBeTruthy();
    adminToken = (await adminLogin.json()).token;

    const studentRes = await request.post(`${API_URL}/api/admin/users`, {
      headers: adminAuth(),
      data: {
        name: `طالب جرس ${stamp}`,
        email: studentEmail,
        password: studentPassword,
        role_id: 3,
      },
    });
    expect(studentRes.status()).toBe(201);
    studentId = (await studentRes.json()).id;

    for (const suffix of ['أ', 'ب']) {
      const groupId = await createCourseAndGroup(request, suffix);
      const assignRes = await request.post(`${API_URL}/api/groups/${groupId}/students`, {
        headers: adminAuth(),
        data: { user_ids: [studentId] },
      });
      expect(assignRes.ok()).toBeTruthy();
    }
  });

  test('student sees the unread badge, opens the panel, reads one and clears the rest', async ({ page }) => {
    await page.goto(`${USER_UI_URL}/login`);
    await page.locator('input[placeholder*="example@email.com"]').fill(studentEmail);
    await page.locator('input[type="password"]').fill(studentPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible();
    const badge = page.getByTestId('notification-unread-badge');
    await expect(badge).toHaveText('2', { timeout: 20_000 });

    await bell.click();
    const panel = page.getByTestId('notification-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('الإشعارات');
    await expect(panel.getByTestId('notification-item')).toHaveCount(2);
    await expect(panel).toContainText('تم إضافتك إلى مجموعة');
    await expect(panel).toContainText('تُحفظ الإشعارات لآخر 30 يوماً فقط');

    // Opening a notification marks it as read and follows its link.
    await panel.getByTestId('notification-item').first().click();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(badge).toHaveText('1');

    // Remaining unread notifications can be cleared in one click.
    await bell.click();
    await expect(panel).toBeVisible();
    await panel.getByTestId('notification-mark-all').click();
    await expect(page.getByTestId('notification-unread-badge')).toHaveCount(0);

    // Read notifications remain in the list (same look, no unread marker).
    await expect(panel.getByTestId('notification-item')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('shows a self-dismissing toast for a new notification', async ({ page, request }) => {
    await page.goto(`${USER_UI_URL}/login`);
    await page.locator('input[placeholder*="example@email.com"]').fill(studentEmail);
    await page.locator('input[type="password"]').fill(studentPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible();
    await expect(page.getByTestId('notification-unread-badge')).toHaveCount(0, { timeout: 20_000 });

    // A new event arrives while the student is inside the platform.
    const groupId = await createCourseAndGroup(request, 'ج');
    const assignRes = await request.post(`${API_URL}/api/groups/${groupId}/students`, {
      headers: adminAuth(),
      data: { user_ids: [studentId] },
    });
    expect(assignRes.ok()).toBeTruthy();

    // Trigger the focus refresh immediately instead of waiting for the poll.
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));

    const toast = page.getByTestId('notification-toast');
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await expect(toast).toContainText('تم إضافتك إلى مجموعة');
    await expect(toast).toContainText('إشعار جديد');
    await expect(bell).toBeVisible();

    // It disappears on its own without touching the page.
    await expect(toast).toHaveCount(0, { timeout: 10_000 });

    // A newer toast opens the organized list when clicked.
    const secondGroupId = await createCourseAndGroup(request, 'د');
    const secondAssign = await request.post(`${API_URL}/api/groups/${secondGroupId}/students`, {
      headers: adminAuth(),
      data: { user_ids: [studentId] },
    });
    expect(secondAssign.ok()).toBeTruthy();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(toast).toBeVisible({ timeout: 15_000 });
    await toast.click();
    await expect(page.getByTestId('notification-panel')).toBeVisible();
    await expect(toast).toHaveCount(0);
  });

  test('admin bell opens a non-blocking dropdown panel', async ({ page, request }) => {
    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    const token = (await login.json()).token;

    await page.addInitScript((adminToken) => {
      window.localStorage.setItem('admin_token', adminToken);
    }, token);

    await page.goto(`${ADMIN_UI_URL}/`);
    const bell = page.getByTestId('notification-bell');
    await expect(bell).toBeVisible({ timeout: 20_000 });
    await bell.click();

    const panel = page.getByTestId('notification-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('الإشعارات');
    await expect(panel).toContainText('تُحفظ الإشعارات لآخر 30 يوماً فقط');

    // The dropdown is dismissible and does not lock the page (no modal).
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /مرحباً/ })).toBeVisible();
  });
});
