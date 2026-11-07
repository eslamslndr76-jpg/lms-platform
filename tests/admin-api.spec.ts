import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, uniqueEmail } from './config';

test.describe('Admin API', () => {
  let token = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    token = (await res.json()).token;
    expect(token).toBeTruthy();
  });

  test('GET /api/categories', async ({ request }) => {
    const res = await request.get('/api/categories');
    expect(res.ok()).toBeTruthy();
    expect(Array.isArray(await res.json())).toBeTruthy();
  });

  test('POST /api/categories', async ({ request }) => {
    const res = await request.post('/api/categories', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name_ar: `برمجة ${Date.now()}`, name_en: `Programming ${Date.now()}` },
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
    if (rows.length === 0) test.skip(true, 'no pending orders to update');
    const res = await request.patch(`/api/admin/orders/${rows[0].id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'paid' },
    });
    expect(res.ok()).toBeTruthy();
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

  test('GET /api/roles/catalog exposes every permission section', async ({ request }) => {
    const res = await request.get('/api/roles/catalog', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const keys = data.sections.map((section: any) => section.key);
    for (const key of ['dashboard', 'courses', 'orders', 'students', 'groups', 'certificates', 'financials', 'employees', 'settings']) {
      expect(keys).toContain(key);
    }
    expect(data.actions.map((action: any) => action.key)).toEqual(['read', 'write']);
  });

  test('GET /api/roles flags the built-in roles as system roles', async ({ request }) => {
    const res = await request.get('/api/roles', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const roles = await res.json();
    const admin = roles.find((role: any) => role.id === 1);
    expect(admin.is_system).toBe(true);
    expect(admin.permissions.all).toBeTruthy();
  });

  test('custom role lifecycle keeps manager-only sections out', async ({ request }) => {
    const name = `Test Role ${Date.now()}`;
    const created = await request.post('/api/roles', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, permissions: { courses: 'read,write', settings: 'read' } },
    });
    expect(created.status()).toBe(201);
    const role = await created.json();
    expect(role.permissions.courses).toBe('read,write');
    expect(role.permissions.settings).toBeUndefined();

    const renamed = await request.put(`/api/roles/${role.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: `${name} x`, permissions: { orders: 'read' } },
    });
    expect(renamed.ok()).toBeTruthy();

    const removed = await request.delete(`/api/roles/${role.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(removed.ok()).toBeTruthy();
  });

  test('system roles are protected from deletion', async ({ request }) => {
    const res = await request.delete('/api/roles/2', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT /api/admin/users/:id/permissions toggles personal overrides', async ({ request }) => {
    const meRes = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.ok()).toBeTruthy();
    const me = await meRes.json();

    const set = await request.put(`/api/admin/users/${me.id}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { permissions: { courses: 'read' } },
    });
    expect(set.ok()).toBeTruthy();
    const applied = await set.json();
    expect(applied.inherited).toBe(false);
    expect(applied.permissions.courses).toBe('read');

    const reset = await request.put(`/api/admin/users/${me.id}/permissions`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { permissions: null },
    });
    expect(reset.ok()).toBeTruthy();
    expect((await reset.json()).inherited).toBe(true);
  });

  test('a personal override can revoke a permission granted by the role', async ({ request }) => {
    const email = uniqueEmail('perm-revoke');
    const created = await request.post('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Permission Revoke', email, password: 'Test1234', role_id: 2 },
    });
    expect(created.status()).toBe(201);
    const { id } = await created.json();

    try {
      // The employee role grants orders:read,write — the account should reach it.
      const login = await request.post('/api/auth/login', {
        data: { email, password: 'Test1234' },
      });
      expect(login.ok()).toBeTruthy();
      const employeeToken = (await login.json()).token;
      const employeeHeaders = { Authorization: `Bearer ${employeeToken}` };

      const before = await request.get('/api/admin/orders', { headers: employeeHeaders });
      expect(before.ok()).toBeTruthy();

      // An empty action list is a deliberate override: revoke read + write.
      const override = await request.put(`/api/admin/users/${id}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { permissions: { orders: '' } },
      });
      expect(override.ok()).toBeTruthy();

      const after = await request.get('/api/admin/orders', { headers: employeeHeaders });
      expect(after.status()).toBe(403);

      const exportCatalog = await request.get('/api/exports/catalog', { headers: employeeHeaders });
      expect(exportCatalog.ok()).toBeTruthy();
      const datasets = (await exportCatalog.json()).datasets.map((d: any) => d.key);
      expect(datasets).not.toContain('orders');

      const exportOrders = await request.get('/api/exports/orders', { headers: employeeHeaders });
      expect(exportOrders.status()).toBe(403);

      // Staff management stays manager-only even for the employee's own row.
      const staffList = await request.get('/api/admin/users?role=staff', { headers: employeeHeaders });
      expect(staffList.status()).toBe(403);
    } finally {
      await request.delete(`/api/admin/users/${id}/hard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  });
});
