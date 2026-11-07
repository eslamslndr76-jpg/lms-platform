import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './config';

test.describe.configure({ mode: 'serial' });

test.describe('Excel exports', () => {
  let adminToken = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    adminToken = (await res.json()).token;
  });

  test('catalog requires authentication', async ({ request }) => {
    const res = await request.get('/api/exports/catalog');
    expect(res.status()).toBe(401);
  });

  test('catalog lists every dataset with columns and filters', async ({ request }) => {
    const res = await request.get('/api/exports/catalog', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const { datasets } = await res.json();

    expect(Array.isArray(datasets)).toBeTruthy();
    expect(datasets.length).toBeGreaterThanOrEqual(10);

    const keys = datasets.map((d: any) => d.key);
    expect(keys).toContain('students');
    expect(keys).toContain('orders');
    expect(keys).toContain('groups');
    expect(keys).toContain('lectures');
    expect(keys).toContain('attendance');
    expect(keys).toContain('certificates');
    expect(keys).toContain('financials');

    const orders = datasets.find((d: any) => d.key === 'orders');
    expect(orders.columns.length).toBeGreaterThan(0);
    expect(orders.columns[0].header).toBeTruthy();
    expect(orders.filters.some((f: any) => f.key === 'status')).toBeTruthy();
  });

  test('xlsx export returns a real Excel workbook', async ({ request }) => {
    const res = await request.get('/api/exports/students?format=xlsx', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.ok()).toBeTruthy();
    expect(res.headers()['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    // An xlsx file is a ZIP archive: PK\x03\x04
    const body = await res.body();
    expect(body.length).toBeGreaterThan(1000);
    expect(body[0]).toBe(0x50);
    expect(body[1]).toBe(0x4b);

    const disposition = res.headers()['content-disposition'] || '';
    expect(disposition).toContain("filename*=UTF-8''");
  });

  test('csv export keeps Arabic readable with a BOM', async ({ request }) => {
    const res = await request.get('/api/exports/students?format=csv', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const text = await res.text();
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('الاسم');
  });

  test('filters are applied to the exported rows', async ({ request }) => {
    const res = await request.get('/api/exports/orders?format=json&status=paid&limit=500', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.dataset).toBe('orders');
    for (const row of data.rows) expect(row.status).toBe('paid');
  });

  test('column selection narrows the workbook', async ({ request }) => {
    const res = await request.get('/api/exports/orders?preview=1&limit=3&columns=student,amount', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.columns.map((c: any) => c.key)).toEqual(['student', 'amount']);
  });

  test('unknown dataset returns 404 with suggestions', async ({ request }) => {
    const res = await request.get('/api/exports/does-not-exist', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(Array.isArray(data.available)).toBeTruthy();
  });

  test('unsupported format is rejected', async ({ request }) => {
    const res = await request.get('/api/exports/students?format=pdf', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status()).toBe(400);
  });
});
