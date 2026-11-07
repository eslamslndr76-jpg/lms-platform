import { test, expect, APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_UI_URL, API_URL, uniqueEmail } from './config';

/**
 * Phase 4 — survey results and settings in the admin UI (edit-plan.md §4.4).
 *
 * Admins see the response rate, averages, reminders and can extend the window.
 */
test.describe.configure({ serial: true });

const LECTURER_KEYS = [
  'lecturer_knowledge',
  'lecturer_communication',
  'lecturer_organization',
  'lecturer_cooperation',
  'lecturer_motivation',
];
const PROGRAM_KEYS = [
  'program_content',
  'program_materials',
  'program_material_organization',
  'program_goals',
  'program_organization',
  'program_duration',
];
const fullAnswers = () => {
  const answers: Record<string, any> = {};
  for (const key of [...LECTURER_KEYS, ...PROGRAM_KEYS]) answers[key] = 4;
  answers.helped_develop = 'yes';
  answers.notes = 'ملاحظة تظهر للإدارة';
  return answers;
};

test.describe('Survey admin UI', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const password = 'Student123!';
  const groupName = `مجموعة استبيان الإدارة ${stamp}`;

  let adminToken = '';
  let courseId = 0;
  let groupId = 0;
  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });

  const createCompletedGroup = async (request: APIRequestContext) => {
    const studentEmail = uniqueEmail('survey-admin');
    const studentRes = await request.post(`${API_URL}/api/admin/users`, {
      headers: adminAuth(),
      data: { name: `طالب استبيان الإدارة ${stamp}`, email: studentEmail, password, role_id: 3 },
    });
    expect(studentRes.status()).toBe(201);
    const studentId = (await studentRes.json()).id as number;

    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: studentEmail, password },
    });
    const studentToken = (await login.json()).token;

    const courseRes = await request.post(`${API_URL}/api/courses`, {
      headers: adminAuth(),
      data: {
        title_ar: `كورس استبيان الإدارة ${stamp}`,
        title_en: `Survey Admin Course ${stamp}`,
        course_mode: 'online',
        max_students: 30,
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    courseId = (await courseRes.json()).id as number;

    const groupRes = await request.post(`${API_URL}/api/groups`, {
      headers: adminAuth(),
      data: { course_id: courseId, name: groupName, status: 'active' },
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
      data: { date: '2026-04-12', topic: 'محاضرة الإدارة' },
    });
    expect(lecture.status()).toBe(201);

    const complete = await request.post(`${API_URL}/api/groups/${groupId}/complete`, {
      headers: adminAuth(),
    });
    expect(complete.ok()).toBeTruthy();

    const submit = await request.post(`${API_URL}/api/surveys/my/${groupId}/submit`, {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { answers: fullAnswers(), is_anonymous: false },
    });
    expect(submit.ok()).toBeTruthy();
  };

  test.beforeAll(async ({ request }) => {
    const login = await request.post(`${API_URL}/api/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(login.ok()).toBeTruthy();
    adminToken = (await login.json()).token;
    await createCompletedGroup(request);
  });

  test.afterAll(async ({ request }) => {
    if (courseId) await request.delete(`${API_URL}/api/courses/${courseId}`, { headers: adminAuth() });
  });

  test('admin sees the response rate, averages and reminder controls', async ({ page }) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem('admin_token', token);
    }, adminToken);

    await page.goto(`${ADMIN_UI_URL}/courses/${courseId}`);
    await page.getByRole('button', { name: /المجموعات/ }).click();

    await expect(page.getByText(groupName).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(groupName).first().click();

    await page.getByRole('button', { name: 'الاستبيان' }).click();

    await expect(page.getByText('نسبة الإجابة')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('1 من 1')).toBeVisible();
    await expect(page.getByText('100%').first()).toBeVisible();
    await expect(page.getByText('متوسط الرضا العام')).toBeVisible();
    await expect(page.getByText('4 / 5').first()).toBeVisible();

    // All 11 online items are listed, grouped, with no place item.
    await expect(page.getByText('أولاً: تقييم المحاضر')).toBeVisible();
    await expect(page.getByText('ثانياً: تقييم البرنامج التدريبي')).toBeVisible();
    await expect(page.getByText('مكان البرنامج')).toHaveCount(0);
    await expect(page.getByText('ملاحظة تظهر للإدارة')).toBeVisible();
    await expect(page.getByText(/المحاضر لا يرى الأسماء ولا النتائج/)).toBeVisible();

    // Everybody answered → the manual reminder is disabled.
    await expect(page.getByRole('button', { name: /تذكير الباقين/ })).toBeDisabled();

    // The window can be extended from the same tab.
    await page.getByRole('button', { name: /تمديد المدة/ }).click();
    await expect(page.getByRole('heading', { name: 'تمديد مدة الاستبيان' })).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('survey settings are editable from the settings page', async ({ page }) => {
    await page.addInitScript((token) => {
      window.localStorage.setItem('admin_token', token);
    }, adminToken);

    await page.goto(`${ADMIN_UI_URL}/settings`);
    await page.getByRole('button', { name: '⭐ الاستبيان' }).click();

    await expect(page.getByText('إعدادات استبيان الطالب')).toBeVisible({ timeout: 20_000 });
    const numbers = page.locator('input[type="number"]');
    await expect(numbers).toHaveCount(3);
    await numbers.nth(0).fill('30');
    await numbers.nth(1).fill('2');
    await numbers.nth(2).fill('5');

    await page.getByRole('button', { name: /حفظ الإعدادات/ }).click();
    await expect(page.getByText('تم حفظ إعدادات الاستبيان')).toBeVisible({ timeout: 15_000 });
  });
});
