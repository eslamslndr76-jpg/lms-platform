import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, uniqueEmail, uniquePhone } from './config';

test.describe.configure({ mode: 'serial' });

test.describe('Backend API', () => {
  let adminToken = '';
  let studentToken = '';
  let courseId = 0;
  let coursePrice = 0;

  // Fresh student per run so repeated runs never hit unique-constraint errors.
  const student = {
    name: 'Test Student',
    email: uniqueEmail('api'),
    password: 'test123',
    phone: uniquePhone(),
    nationalId: `${Date.now()}`.padStart(14, '9').slice(0, 14),
  };

  test('health check', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.ok()).toBeTruthy();
    expect((await res.json()).status).toBe('ok');
  });

  test('branding public', async ({ request }) => {
    const res = await request.get('/api/branding');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.systemName).toBeDefined();
  });

  test('register student', async ({ request }) => {
    const res = await request.post('/api/auth/register', { data: student });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.token).toBeDefined();
  });

  test('login as admin', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('admin');
    adminToken = data.token;
  });

  test('login as student', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: student.email, password: student.password },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('student');
    studentToken = data.token;
  });

  test('get courses (public)', async ({ request }) => {
    const res = await request.get('/api/courses');
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test('create course (admin)', async ({ request }) => {
    const res = await request.post('/api/courses', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        title_ar: `كورس تجريبي ${Date.now()}`,
        title_en: 'Test Course',
        price: 500,
      },
    });
    expect(res.status()).toBe(201);
    const created = await res.json();
    courseId = created.id;

    // Read back the persisted price instead of assuming it.
    const detail = await request.get(`/api/courses/${courseId}`);
    expect(detail.ok()).toBeTruthy();
    coursePrice = Number((await detail.json()).price);
    expect(coursePrice).toBeGreaterThan(0);
  });

  test('create order (student)', async ({ request }) => {
    expect(courseId, 'courseId must be set by the previous test').toBeGreaterThan(0);
    const res = await request.post('/api/orders', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { course_id: courseId, amount: coursePrice },
    });
    const body = await res.json();
    expect(res.status(), `Order error: ${JSON.stringify(body)}`).toBe(201);
    expect(body.status).toBe('pending');
  });

  test('get my orders', async ({ request }) => {
    const res = await request.get('/api/orders/my', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const orders = await res.json();
    expect(orders.length).toBeGreaterThanOrEqual(1);
  });
});
