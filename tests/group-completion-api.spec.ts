import { test, expect, APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, uniqueEmail } from './config';

/**
 * Phase 3 — manual group completion (edit-plan.md §4.2).
 *
 * Completion is an explicit admin action (never derived from lecture dates),
 * it unlocks the post-course flow, notifies students and can be undone.
 */
test.describe.configure({ serial: true });

test.describe('Manual group completion API', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const studentPassword = 'Student123!';
  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
  const studentAuth = () => ({ Authorization: `Bearer ${studentToken}` });

  let adminToken = '';
  let studentToken = '';
  let secondStudentId = 0;
  let courseId = 0;
  let groupId = 0;
  let lectureId = 0;

  const createStudent = async (request: APIRequestContext, suffix: string) => {
    const res = await request.post('/api/admin/users', {
      headers: adminAuth(),
      data: {
        name: `طالب إنهاء ${suffix} ${stamp}`,
        email: uniqueEmail(`group-complete-${suffix}`),
        password: studentPassword,
        role_id: 3,
      },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).id as number;
  };

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.ok()).toBeTruthy();
    adminToken = (await adminLogin.json()).token;
    expect(adminToken).toBeTruthy();

    const studentEmail = uniqueEmail('group-complete-student');
    const studentRes = await request.post('/api/admin/users', {
      headers: adminAuth(),
      data: {
        name: `طالب إنهاء رئيسي ${stamp}`,
        email: studentEmail,
        password: studentPassword,
        role_id: 3,
      },
    });
    expect(studentRes.status()).toBe(201);
    const studentId = (await studentRes.json()).id as number;
    secondStudentId = await createStudent(request, 'ثانوي');

    const login = await request.post('/api/auth/login', {
      data: { email: studentEmail, password: studentPassword },
    });
    expect(login.ok()).toBeTruthy();
    studentToken = (await login.json()).token;

    const courseRes = await request.post('/api/courses', {
      headers: adminAuth(),
      data: {
        title_ar: `كورس إنهاء ${stamp}`,
        title_en: `Completion Course ${stamp}`,
        course_mode: 'online',
        max_students: 50,
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    courseId = (await courseRes.json()).id as number;

    // Keep the course to a single round so assertions are deterministic.
    const updateCourse = await request.put(`/api/courses/${courseId}`, {
      headers: adminAuth(),
      data: { prevent_overlap: 0 },
    });
    expect(updateCourse.ok()).toBeTruthy();

    const groupRes = await request.post('/api/groups', {
      headers: adminAuth(),
      data: {
        course_id: courseId,
        name: `مجموعة إنهاء ${stamp}`,
        status: 'active',
      },
    });
    expect(groupRes.status()).toBe(201);
    groupId = (await groupRes.json()).id as number;

    const assignRes = await request.post(`/api/groups/${groupId}/students`, {
      headers: adminAuth(),
      data: { user_ids: [studentId] },
    });
    expect(assignRes.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (courseId) {
      await request.delete(`/api/courses/${courseId}`, { headers: adminAuth() });
    }
  });

  test('completion and reopening are admin-only', async ({ request }) => {
    const anonymous = await request.post(`/api/groups/${groupId}/complete`);
    expect(anonymous.status()).toBe(401);

    const studentAttempt = await request.post(`/api/groups/${groupId}/complete`, {
      headers: studentAuth(),
    });
    expect(studentAttempt.status()).toBe(403);

    const studentReopen = await request.post(`/api/groups/${groupId}/reopen`, {
      headers: studentAuth(),
    });
    expect(studentReopen.status()).toBe(403);
  });

  test('rejects completing a group without lectures or creating a completed group', async ({ request }) => {
    const empty = await request.post(`/api/groups/${groupId}/complete`, {
      headers: adminAuth(),
    });
    expect(empty.status()).toBe(400);
    expect((await empty.json()).error).toContain('محاضرة');

    const createCompleted = await request.post('/api/groups', {
      headers: adminAuth(),
      data: {
        course_id: courseId,
        name: `مجموعة مكتملة ${stamp}`,
        status: 'completed',
      },
    });
    expect(createCompleted.status()).toBe(400);
  });

  test('completes the group, notifies students and freezes the group', async ({ request }) => {
    const lectureRes = await request.post(`/api/groups/${groupId}/lectures`, {
      headers: adminAuth(),
      data: { date: '2026-02-15', topic: `محاضرة الإنهاء ${stamp}` },
    });
    expect(lectureRes.status()).toBe(201);
    lectureId = (await lectureRes.json()).id as number;

    const complete = await request.post(`/api/groups/${groupId}/complete`, {
      headers: adminAuth(),
    });
    expect(complete.ok()).toBeTruthy();
    const body = await complete.json();
    expect(body.students).toBe(1);
    expect(typeof body.certificates).toBe('number');

    const detail = await request.get(`/api/groups/${groupId}`, { headers: adminAuth() });
    expect(detail.ok()).toBeTruthy();
    const group = await detail.json();
    expect(group.status).toBe('completed');
    expect(Number(group.is_complete)).toBe(1);
    expect(Number(group.is_active)).toBe(0);
    expect(group.completed_at).toBeTruthy();
    expect(group.completed_by).toBeTruthy();
    expect(group.completed_by_name).toBeTruthy();

    // Students receive the completion notification with a working link.
    const notifications = await request.get('/api/notifications?limit=50', {
      headers: studentAuth(),
    });
    expect(notifications.ok()).toBeTruthy();
    const items = await notifications.json();
    const completionNotice = items.find((n: any) => n.title === 'انتهت مجموعتك');
    expect(completionNotice).toBeTruthy();
    expect(completionNotice.link).toBe('/my-courses');

    // No new students, lectures or attendance on a completed group.
    const addStudent = await request.post(`/api/groups/${groupId}/students`, {
      headers: adminAuth(),
      data: { user_ids: [secondStudentId] },
    });
    expect(addStudent.status()).toBe(400);
    expect((await addStudent.json()).error).toContain('منتهية');

    const addLecture = await request.post(`/api/groups/${groupId}/lectures`, {
      headers: adminAuth(),
      data: { date: '2026-02-20', topic: 'محاضرة إضافية' },
    });
    expect(addLecture.status()).toBe(400);

    const startAttendance = await request.post(`/api/attendance/${lectureId}/start`, {
      headers: adminAuth(),
    });
    expect(startAttendance.status()).toBe(400);

    // Status can only change through the dedicated buttons.
    const completeAgain = await request.post(`/api/groups/${groupId}/complete`, {
      headers: adminAuth(),
    });
    expect(completeAgain.status()).toBe(400);

    const manualStatus = await request.put(`/api/groups/${groupId}`, {
      headers: adminAuth(),
      data: { status: 'active' },
    });
    expect(manualStatus.status()).toBe(400);

    const batchCompleted = await request.post('/api/groups/batch/status', {
      headers: adminAuth(),
      data: { ids: [groupId], status: 'completed' },
    });
    expect(batchCompleted.status()).toBe(400);
  });

  test('reopens the group and allows assignments again', async ({ request }) => {
    const reopen = await request.post(`/api/groups/${groupId}/reopen`, {
      headers: adminAuth(),
    });
    expect(reopen.ok()).toBeTruthy();

    const detail = await request.get(`/api/groups/${groupId}`, { headers: adminAuth() });
    const group = await detail.json();
    expect(group.status).toBe('active');
    expect(Number(group.is_complete)).toBe(0);
    expect(Number(group.is_active)).toBe(1);
    expect(group.completed_at).toBeNull();
    expect(group.completed_by).toBeNull();

    const addStudent = await request.post(`/api/groups/${groupId}/students`, {
      headers: adminAuth(),
      data: { user_ids: [secondStudentId] },
    });
    expect(addStudent.ok()).toBeTruthy();

    const reopenAgain = await request.post(`/api/groups/${groupId}/reopen`, {
      headers: adminAuth(),
    });
    expect(reopenAgain.status()).toBe(400);
    expect((await reopenAgain.json()).error).toContain('غير منتهية');
  });
});
