import { test, expect, APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_UI_URL, API_URL } from './config';

/**
 * Phase 3 — manual group completion in the admin UI (edit-plan.md §4.2).
 *
 * The admin finishes a group from the course page, sees the official state,
 * and can undo it with "reopen".
 */
test.describe.configure({ serial: true });

test.describe('Group completion UI', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let adminToken = '';
  let courseId = 0;
  let groupId = 0;
  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });

  const createCourseAndGroup = async (request: APIRequestContext) => {
    const courseRes = await request.post(`${API_URL}/api/courses`, {
      headers: adminAuth(),
      data: {
        title_ar: `كورس إنهاء واجهة ${stamp}`,
        title_en: `Completion UI Course ${stamp}`,
        course_mode: 'online',
        max_students: 30,
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    courseId = (await courseRes.json()).id;

    const groupRes = await request.post(`${API_URL}/api/groups`, {
      headers: adminAuth(),
      data: {
        course_id: courseId,
        name: `مجموعة واجهة ${stamp}`,
        status: 'active',
      },
    });
    expect(groupRes.status()).toBe(201);
    groupId = (await groupRes.json()).id;

    const lectureRes = await request.post(`${API_URL}/api/groups/${groupId}/lectures`, {
      headers: adminAuth(),
      data: { date: '2026-03-01', topic: 'محاضرة الواجهة' },
    });
    expect(lectureRes.status()).toBe(201);
  };

  test.beforeAll(async ({ request }) => {
    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    adminToken = (await login.json()).token;
    await createCourseAndGroup(request);
  });

  test.afterAll(async ({ request }) => {
    if (courseId) {
      await request.delete(`${API_URL}/api/courses/${courseId}`, { headers: adminAuth() });
    }
  });

  test('admin completes then reopens a group from the course page', async ({ page }) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem('admin_token', token);
    }, adminToken);

    await page.goto(`${ADMIN_UI_URL}/courses/${courseId}`);
    await page.getByRole('button', { name: /المجموعات/ }).click();

    const completeBtn = page.getByTestId(`group-complete-${groupId}`);
    await expect(completeBtn).toBeVisible({ timeout: 20_000 });
    await completeBtn.click();

    const dialog = page.getByText('إنهاء المجموعة', { exact: true });
    await expect(dialog.first()).toBeVisible();
    await page.getByRole('button', { name: 'إنهاء المجموعة' }).click();

    // Official state: the row switches to "reopen" and shows the completed badge.
    const reopenBtn = page.getByTestId(`group-reopen-${groupId}`);
    await expect(reopenBtn).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(`group-complete-${groupId}`)).toHaveCount(0);
    await expect(page.getByText('مكتملة').first()).toBeVisible();

    const completedDetail = await page.request.get(`${API_URL}/api/groups/${groupId}`, {
      headers: adminAuth(),
    });
    expect((await completedDetail.json()).status).toBe('completed');

    // Undo is available and restores the group.
    await reopenBtn.click();
    await page.getByRole('button', { name: 'إعادة الفتح' }).click();
    await expect(page.getByTestId(`group-complete-${groupId}`)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId(`group-reopen-${groupId}`)).toHaveCount(0);

    const reopenedDetail = await page.request.get(`${API_URL}/api/groups/${groupId}`, {
      headers: adminAuth(),
    });
    expect((await reopenedDetail.json()).status).toBe('active');
  });

  test('add-group form no longer offers a "completed" status', async ({ page }) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem('admin_token', token);
    }, adminToken);

    await page.goto(`${ADMIN_UI_URL}/courses/${courseId}`);
    await page.getByRole('button', { name: /المجموعات/ }).click();
    await page.getByRole('button', { name: '+ إضافة مجموعة' }).click();

    const modal = page.getByRole('heading', { name: 'إضافة مجموعة' }).locator('xpath=../..');
    await expect(modal).toBeVisible();
    await expect(modal.locator('option', { hasText: 'مكتملة' })).toHaveCount(0);
    await expect(modal.locator('option', { hasText: 'قيد الانتظار' })).toHaveCount(1);
  });
});
