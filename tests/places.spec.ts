import { test, expect, APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, uniqueEmail } from './config';

/**
 * Phase 1 — Places (rooms) and the hard capacity limit they impose on groups.
 *
 * Covers the acceptance checklist in edit-plan.md §4.1:
 *  - create / disable a place
 *  - the place appears only for offline groups
 *  - the group capacity is filled from the place capacity
 *  - adding students beyond capacity is rejected
 *  - shrinking a place below the registered count is rejected
 *  - changing a place for a group that does not fit is rejected
 */
test.describe.configure({ serial: true });

test.describe('Places & capacity', () => {
  let token = '';
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const placeName = `قاعة اختبار ${stamp}`;
  const smallPlaceName = `قاعة صغيرة ${stamp}`;
  const courseTitle = `كورس أماكن ${stamp}`;
  const onlineCourseTitle = `كورس أونلاين ${stamp}`;

  let placeId = 0;
  let smallPlaceId = 0;
  let offlineCourseId = 0;
  let onlineCourseId = 0;
  let groupId = 0;
  const studentIds: number[] = [];

  const auth = () => ({ Authorization: `Bearer ${token}` });

  const createStudent = async (request: APIRequestContext) => {
    const res = await request.post('/api/admin/users', {
      headers: auth(),
      data: {
        name: `طالب اختبار ${Math.random().toString(36).slice(2, 8)}`,
        email: uniqueEmail('place-student'),
        password: 'Student123!',
        role_id: 3,
      },
    });
    expect(res.status()).toBe(201);
    return (await res.json()).id as number;
  };

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBeTruthy();
    token = (await res.json()).token;
    expect(token).toBeTruthy();
  });

  test('places endpoints require authentication', async ({ request }) => {
    const res = await request.get('/api/places');
    expect(res.status()).toBe(401);
  });

  test('creates a place with a capacity', async ({ request }) => {
    const res = await request.post('/api/places', {
      headers: auth(),
      data: { name: placeName, capacity: 2 },
    });
    expect(res.status()).toBe(201);
    placeId = (await res.json()).id;
    expect(placeId).toBeGreaterThan(0);
  });

  test('rejects a duplicate place name and an invalid capacity', async ({ request }) => {
    const duplicate = await request.post('/api/places', {
      headers: auth(),
      data: { name: placeName, capacity: 10 },
    });
    expect(duplicate.status()).toBe(400);
    expect((await duplicate.json()).error).toContain('بالفعل');

    const invalid = await request.post('/api/places', {
      headers: auth(),
      data: { name: `قاعة غير صالحة ${stamp}`, capacity: 0 },
    });
    expect(invalid.status()).toBe(400);
  });

  test('lists the place with its capacity', async ({ request }) => {
    const res = await request.get('/api/places', { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const places = await res.json();
    const place = places.find((p: any) => p.id === placeId);
    expect(place).toBeTruthy();
    expect(place.name).toBe(placeName);
    expect(place.capacity).toBe(2);
    expect(place.is_active).toBe(1);
  });

  test('creates an offline course and fills group capacity from the place', async ({ request }) => {
    const courseRes = await request.post('/api/courses', {
      headers: auth(),
      data: {
        title_ar: courseTitle,
        title_en: `Places Course ${stamp}`,
        course_mode: 'offline',
        max_students: 50,
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    offlineCourseId = (await courseRes.json()).id;

    const groupRes = await request.post('/api/groups', {
      headers: auth(),
      data: {
        course_id: offlineCourseId,
        name: `مجموعة أماكن ${stamp}`,
        place_id: placeId,
        status: 'active',
      },
    });
    expect(groupRes.status()).toBe(201);
    groupId = (await groupRes.json()).id;

    const group = await (await request.get(`/api/groups/${groupId}`, { headers: auth() })).json();
    expect(group.place_id).toBe(placeId);
    expect(group.place_name).toBe(placeName);
    expect(group.place_capacity).toBe(2);
    // Capacity auto-filled from the room, not from the course (50).
    expect(group.max_students).toBe(2);
  });

  test('rejects a group capacity above the place capacity', async ({ request }) => {
    const res = await request.post('/api/groups', {
      headers: auth(),
      data: {
        course_id: offlineCourseId,
        name: `مجموعة أكبر من السعة ${stamp}`,
        place_id: placeId,
        max_students: 5,
        status: 'pending',
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('سعة المكان');
  });

  test('rejects a place on an online course', async ({ request }) => {
    const courseRes = await request.post('/api/courses', {
      headers: auth(),
      data: {
        title_ar: onlineCourseTitle,
        title_en: `Online Course ${stamp}`,
        course_mode: 'online',
        price: 0,
      },
    });
    expect(courseRes.status()).toBe(201);
    onlineCourseId = (await courseRes.json()).id;

    const res = await request.post('/api/groups', {
      headers: auth(),
      data: {
        course_id: onlineCourseId,
        name: `مجموعة أونلاين ${stamp}`,
        place_id: placeId,
        status: 'active',
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('الأوفلاين');
  });

  test('enforces the capacity while adding students', async ({ request }) => {
    for (let i = 0; i < 3; i++) studentIds.push(await createStudent(request));

    const first = await request.post(`/api/groups/${groupId}/students`, {
      headers: auth(),
      data: { user_ids: studentIds.slice(0, 2) },
    });
    expect(first.ok()).toBeTruthy();
    expect((await first.json()).added).toBe(2);

    const over = await request.post(`/api/groups/${groupId}/students`, {
      headers: auth(),
      data: { user_ids: [studentIds[2]] },
    });
    expect(over.status()).toBe(400);
    expect((await over.json()).error).toContain('ممتلئة');

    const students = await (await request.get(`/api/groups/${groupId}/students`, { headers: auth() })).json();
    expect(students.length).toBe(2);
  });

  test('rejects shrinking the place below the registered students', async ({ request }) => {
    const res = await request.put(`/api/places/${placeId}`, {
      headers: auth(),
      data: { capacity: 1 },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('لا يمكن تقليل السعة');

    const place = await (await request.get(`/api/places/${placeId}`, { headers: auth() })).json();
    expect(place.capacity).toBe(2);
  });

  test('rejects moving the group to a smaller place', async ({ request }) => {
    const create = await request.post('/api/places', {
      headers: auth(),
      data: { name: smallPlaceName, capacity: 1 },
    });
    expect(create.status()).toBe(201);
    smallPlaceId = (await create.json()).id;

    const res = await request.put(`/api/groups/${groupId}`, {
      headers: auth(),
      data: { place_id: smallPlaceId },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('سعته 1');
  });

  test('disables a used place instead of deleting it', async ({ request }) => {
    const res = await request.delete(`/api/places/${placeId}`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.disabled).toBe(true);

    const place = await (await request.get(`/api/places/${placeId}`, { headers: auth() })).json();
    expect(place.is_active).toBe(0);

    // The old group keeps its place, but new groups cannot pick it any more.
    const group = await (await request.get(`/api/groups/${groupId}`, { headers: auth() })).json();
    expect(group.place_id).toBe(placeId);
    expect(group.place_name).toBe(placeName);

    const newCourse = await request.post('/api/courses', {
      headers: auth(),
      data: {
        title_ar: `كورس تعطيل ${stamp}`,
        title_en: `Disabled Place Course ${stamp}`,
        course_mode: 'offline',
        price: 0,
      },
    });
    expect(newCourse.status()).toBe(201);
    const newCourseId = (await newCourse.json()).id;

    const res2 = await request.post('/api/groups', {
      headers: auth(),
      data: {
        course_id: newCourseId,
        name: `مجموعة مكان معطّل ${stamp}`,
        place_id: placeId,
        status: 'active',
      },
    });
    expect(res2.status()).toBe(400);
    expect((await res2.json()).error).toContain('غير مفعّل');
  });
});
