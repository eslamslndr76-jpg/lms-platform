import { test, expect, APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, API_URL, USER_UI_URL, uniqueEmail } from './config';

/**
 * Phase 4 — student survey in the user UI (edit-plan.md §4.4).
 *
 * The dashboard card opens a mobile-first, auto-saving survey; the student
 * answers once and cannot edit afterwards.
 */
test.describe.configure({ serial: true });

test.describe('Student survey UI', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const password = 'Student123!';

  let adminToken = '';
  let studentToken = '';
  let studentEmail = '';
  let courseId = 0;
  let groupId = 0;
  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.ok()).toBeTruthy();
    adminToken = (await adminLogin.json()).token;

    studentEmail = uniqueEmail('survey-ui');
    const studentRes = await request.post(`${API_URL}/api/admin/users`, {
      headers: adminAuth(),
      data: {
        name: `طالب استبيان واجهة ${stamp}`,
        email: studentEmail,
        password,
        role_id: 3,
      },
    });
    expect(studentRes.status()).toBe(201);
    const studentId = (await studentRes.json()).id as number;

    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: studentEmail, password },
    });
    expect(login.ok()).toBeTruthy();
    studentToken = (await login.json()).token;

    const courseRes = await request.post(`${API_URL}/api/courses`, {
      headers: adminAuth(),
      data: {
        title_ar: `كورس استبيان الواجهة ${stamp}`,
        title_en: `Survey UI Course ${stamp}`,
        course_mode: 'online',
        max_students: 30,
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    courseId = (await courseRes.json()).id as number;

    const groupRes = await request.post(`${API_URL}/api/groups`, {
      headers: adminAuth(),
      data: { course_id: courseId, name: `مجموعة استبيان الواجهة ${stamp}`, status: 'active' },
    });
    expect(groupRes.status()).toBe(201);
    groupId = (await groupRes.json()).id as number;

    const assign = await request.post(`${API_URL}/api/groups/${groupId}/students`, {
      headers: adminAuth(),
      data: { user_ids: [studentId] },
    });
    expect(assign.ok()).toBeTruthy();

    const lecture = await request.post(`${API_URL}/api/groups/${groupId}/lectures`, {
      headers: adminAuth(),
      data: { date: '2026-04-10', topic: 'محاضرة الاستبيان' },
    });
    expect(lecture.status()).toBe(201);

    const complete = await request.post(`${API_URL}/api/groups/${groupId}/complete`, {
      headers: adminAuth(),
    });
    expect(complete.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (courseId) await request.delete(`${API_URL}/api/courses/${courseId}`, { headers: adminAuth() });
  });

  test('student answers from the dashboard card and cannot edit afterwards', async ({ page }) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem('token', token);
    }, studentToken);

    await page.goto(`${USER_UI_URL}/dashboard`);

    // The «قيّم دورتك» card is visible until the student answers.
    const card = page.getByText('قيّم دورتك', { exact: true }).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`a[href="/survey/${groupId}"]`)).toBeVisible();
    await page.locator(`a[href="/survey/${groupId}"]`).click();

    await expect(page).toHaveURL(new RegExp(`/survey/${groupId}`));
    await expect(page.getByRole('heading', { name: 'قيّم دورتك' })).toBeVisible();
    await expect(page.getByText(`كورس استبيان الواجهة ${stamp}`).first()).toBeVisible();
    await expect(page.getByText('الخطوة 1 من 4')).toBeVisible();

    // Read-only data + the name toggle (on by default).
    await expect(page.getByText('بياناتك وبيانات البرنامج')).toBeVisible();
    await expect(page.getByText('إظهار اسمي وبياناتي للإدارة')).toBeVisible();
    await expect(page.getByText(/مفعّل — سترى الإدارة اسمك/)).toBeVisible();
    await expect(page.getByText('مكان البرنامج')).toHaveCount(0);

    // Step 1 — lecturer (5 items).
    await page.getByRole('button', { name: /^التالي/ }).click();
    await expect(page.getByText('أولاً: تقييم المحاضر')).toBeVisible();
    await expect(page.getByText('إلمام المدرب بمواضيع البرنامج')).toBeVisible();
    const lecturerStars = page.locator('button[aria-pressed]').filter({ hasText: 'ممتاز' });
    await expect(lecturerStars).toHaveCount(5);
    for (let i = 0; i < 5; i++) await lecturerStars.nth(i).click();
    await expect(page.getByText('42%')).toBeVisible();

    // Step 2 — program (6 items, no place for online).
    await page.getByRole('button', { name: /^التالي/ }).click();
    await expect(page.getByText('ثانياً: تقييم البرنامج التدريبي')).toBeVisible();
    await expect(page.getByText('مكان البرنامج')).toHaveCount(0);
    const programStars = page.locator('button[aria-pressed]').filter({ hasText: 'ممتاز' });
    await expect(programStars).toHaveCount(6);
    for (let i = 0; i < 6; i++) await programStars.nth(i).click();

    // Step 3 — helped question + notes.
    await page.getByRole('button', { name: /^التالي/ }).click();
    await expect(page.getByText('ثالثاً: معلومات عامة')).toBeVisible();
    await page.getByRole('button', { name: 'نعم' }).click();

    const notes = page.getByPlaceholder('اكتب ملاحظاتك هنا…');
    const saved = page.waitForResponse(
      res => res.url().includes(`/api/surveys/my/${groupId}/draft`) && res.request().method() === 'PUT',
      { timeout: 15_000 },
    );
    await notes.fill('ملاحظة من اختبار الواجهة');
    await saved;
    await expect(page.getByText(/تم الحفظ التلقائي/)).toBeVisible();

    // Reloading resumes the same step with the saved answers.
    await page.reload();
    await expect(page.getByText('الخطوة 4 من 4')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder('اكتب ملاحظاتك هنا…')).toHaveValue('ملاحظة من اختبار الواجهة');
    await expect(page.getByRole('button', { name: 'نعم' })).toHaveAttribute('aria-pressed', 'true');

    // Submit once — final.
    await page.getByRole('button', { name: /إرسال الإجابة/ }).click();
    await expect(page.getByRole('heading', { name: 'شكراً لك!' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/إجابة واحدة لكل طالب/)).toBeVisible();

    // The dashboard card disappears after answering.
    await page.goto(`${USER_UI_URL}/dashboard`);
    await expect(page.locator(`a[href="/survey/${groupId}"]`)).toHaveCount(0);
  });
});
