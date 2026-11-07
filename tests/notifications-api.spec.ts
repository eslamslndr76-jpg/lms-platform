import { test, expect, APIRequestContext } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ADMIN_EMAIL, ADMIN_PASSWORD, uniqueEmail } from './config';

/**
 * Phase 2 — in-app notifications (edit-plan.md §4.3).
 *
 * The bell/list UI is built on the existing notification service. These tests
 * cover the backend contract it relies on: unread count, per-item read,
 * mark-all-read, the direct link, and the 30-day retention window.
 */
test.describe.configure({ serial: true });

test.describe('In-app notifications API', () => {
  let adminToken = '';
  let studentEmail = '';
  const studentPassword = 'Student123!';
  let studentId = 0;
  let studentToken = '';
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const oldTitle = `إشعار قديم ${stamp}`;
  const notificationIds: number[] = [];

  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
  const studentAuth = () => ({ Authorization: `Bearer ${studentToken}` });

  const createCourseAndGroup = async (request: APIRequestContext, suffix: string) => {
    const courseRes = await request.post('/api/courses', {
      headers: adminAuth(),
      data: {
        title_ar: `كورس إشعارات ${suffix} ${stamp}`,
        title_en: `Notifications Course ${suffix} ${stamp}`,
        course_mode: 'online',
        max_students: 50,
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    const courseId = (await courseRes.json()).id as number;

    const groupRes = await request.post('/api/groups', {
      headers: adminAuth(),
      data: {
        course_id: courseId,
        name: `مجموعة إشعارات ${suffix} ${stamp}`,
        status: 'active',
      },
    });
    expect(groupRes.status()).toBe(201);
    return (await groupRes.json()).id as number;
  };

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.ok()).toBeTruthy();
    adminToken = (await adminLogin.json()).token;
    expect(adminToken).toBeTruthy();

    studentEmail = uniqueEmail('notification-student');
    const studentRes = await request.post('/api/admin/users', {
      headers: adminAuth(),
      data: {
        name: `طالب إشعارات ${stamp}`,
        email: studentEmail,
        password: studentPassword,
        role_id: 3,
      },
    });
    expect(studentRes.status()).toBe(201);
    studentId = (await studentRes.json()).id;

    // Assigning a student to a group creates a notification through the
    // existing group service — no test-only notification endpoint is used.
    for (const suffix of ['أ', 'ب']) {
      const groupId = await createCourseAndGroup(request, suffix);
      const assignRes = await request.post(`/api/groups/${groupId}/students`, {
        headers: adminAuth(),
        data: { user_ids: [studentId] },
      });
      expect(assignRes.ok()).toBeTruthy();
    }

    const studentLogin = await request.post('/api/auth/login', {
      data: { email: studentEmail, password: studentPassword },
    });
    expect(studentLogin.ok()).toBeTruthy();
    studentToken = (await studentLogin.json()).token;
    expect(studentToken).toBeTruthy();
  });

  test('requires authentication', async ({ request }) => {
    const list = await request.get('/api/notifications');
    expect(list.status()).toBe(401);

    const count = await request.get('/api/notifications/unread-count');
    expect(count.status()).toBe(401);
  });

  test('returns the two assignment notifications with links and unread badges', async ({ request }) => {
    const res = await request.get('/api/notifications?limit=30', { headers: studentAuth() });
    expect(res.ok()).toBeTruthy();
    const items = await res.json();
    expect(Array.isArray(items)).toBeTruthy();
    expect(items).toHaveLength(2);

    for (const item of items) {
      expect(item.title).toBe('تم إضافتك إلى مجموعة');
      expect(item.link).toBe('/dashboard');
      expect(Number(item.is_read)).toBe(0);
      expect(item.created_at).toBeTruthy();
      notificationIds.push(Number(item.id));
    }

    // Newest first.
    expect(notificationIds[0]).toBeGreaterThan(notificationIds[1]);

    const countRes = await request.get('/api/notifications/unread-count', {
      headers: studentAuth(),
    });
    expect(countRes.ok()).toBeTruthy();
    expect((await countRes.json()).count).toBe(2);
  });

  test('marks a single notification as read when it is opened', async ({ request }) => {
    const res = await request.patch(`/api/notifications/${notificationIds[0]}/read`, {
      headers: studentAuth(),
    });
    expect(res.ok()).toBeTruthy();

    const countRes = await request.get('/api/notifications/unread-count', {
      headers: studentAuth(),
    });
    expect((await countRes.json()).count).toBe(1);

    const list = await (await request.get('/api/notifications?limit=30', { headers: studentAuth() })).json();
    const opened = list.find((item: any) => Number(item.id) === notificationIds[0]);
    expect(Number(opened.is_read)).toBe(1);
  });

  test('marks every notification as read', async ({ request }) => {
    const res = await request.patch('/api/notifications/read-all', { headers: studentAuth() });
    expect(res.ok()).toBeTruthy();

    const countRes = await request.get('/api/notifications/unread-count', {
      headers: studentAuth(),
    });
    expect((await countRes.json()).count).toBe(0);

    const list = await (await request.get('/api/notifications?limit=30', { headers: studentAuth() })).json();
    expect(list.every((item: any) => Number(item.is_read) === 1)).toBeTruthy();
  });

  test('keeps only the last 30 days in the list and the unread count', async ({ request }) => {
    const dbPath = path.resolve(process.cwd(), 'backend', 'data.db');
    test.skip(!existsSync(dbPath), 'local SQLite database is not available');

    const db = new DatabaseSync(dbPath);
    try {
      db.exec('PRAGMA busy_timeout = 5000');
      // Insert an unread notification that is 40 days old directly, because
      // the public API never lets a client forge timestamps.
      db.prepare(
        `INSERT INTO notifications (user_id, title, message, type, link, is_read, created_at)
         VALUES (?, ?, ?, 'info', '/dashboard', 0, datetime('now','-40 days'))`,
      ).run(studentId, oldTitle, 'إشعار خارج نطاق الاحتفاظ');
    } finally {
      db.close();
    }

    const list = await (await request.get('/api/notifications?limit=30', { headers: studentAuth() })).json();
    expect(list.some((item: any) => item.title === oldTitle)).toBeFalsy();

    const countRes = await request.get('/api/notifications/unread-count', {
      headers: studentAuth(),
    });
    expect((await countRes.json()).count).toBe(0);
  });
});
