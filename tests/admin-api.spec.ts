import { test, expect } from '@playwright/test';

test.describe('Admin API', () => {
  let token = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'admin@lms.com', password: 'admin123' },
    });
    token = (await res.json()).token;
  });

  test('GET /api/categories', async ({ request }) => {
    const res = await request.get('/api/categories');
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test('POST /api/categories', async ({ request }) => {
    const res = await request.post('/api/categories', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name_ar: 'برمجة', name_en: 'Programming' },
    });
    expect(res.status()).toBe(201);
  });

  test('GET /api/admin/orders', async ({ request }) => {
    const res = await request.get('/api/admin/orders', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.orders).toBeDefined();
  });

  test('GET /api/admin/orders/financials', async ({ request }) => {
    const res = await request.get('/api/admin/orders/financials', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.totalPaid).toBeDefined();
    expect(data.totalPending).toBeDefined();
  });

  test('PATCH /api/admin/orders/:id/status', async ({ request }) => {
    const orders = await request.get('/api/admin/orders?status=pending', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rows = (await orders.json()).orders;
    if (rows.length > 0) {
      const res = await request.patch(`/api/admin/orders/${rows[0].id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { status: 'paid' },
      });
      expect(res.ok()).toBeTruthy();
    }
  });

  test('GET /api/admin/users', async ({ request }) => {
    const res = await request.get('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.users).toBeDefined();
  });

  test('GET /api/groups', async ({ request }) => {
    const res = await request.get('/api/groups', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
  });
});
