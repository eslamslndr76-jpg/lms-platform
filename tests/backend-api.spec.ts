import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test.describe('Backend API', () => {
  let adminToken = '';
  let studentToken = '';

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
    const res = await request.post('/api/auth/register', {
      data: { name: 'Test Student', email: 'test@test.com', password: 'test123', phone: '01000000000' },
    });
    // May already exist from previous runs
    if (res.status() === 409) return;
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.token).toBeDefined();
  });

  test('login as admin', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'admin@lms.com', password: 'admin123' },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.user.role).toBe('admin');
    adminToken = data.token;
  });

  test('login as student', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'test@test.com', password: 'test123' },
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
      data: { title_ar: 'كورس تجريبي', title_en: 'Test Course', price: 500 },
    });
    expect(res.status()).toBe(201);
  });

  test('create order (student)', async ({ request }) => {
    const res = await request.post('/api/orders', {
      headers: { Authorization: `Bearer ${studentToken}` },
      data: { course_id: 1, amount: 500 },
    });
    const body = await res.json();
    if (!res.ok()) console.log('Order error:', JSON.stringify(body));
    expect(res.status()).toBe(201);
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
