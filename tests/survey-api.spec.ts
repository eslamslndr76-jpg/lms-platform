import { test, expect, APIRequestContext } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, uniqueEmail } from './config';

/**
 * Phase 4 — post-course student survey (edit-plan.md §4.4).
 *
 * Group-level survey: one response per student, auto-saved draft, anonymous
 * toggle, two reminders, 30-day window, admin-only results.
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

const answersWith = (rating: number, overrides: Record<string, any> = {}) => {
  const answers: Record<string, any> = {};
  for (const key of [...LECTURER_KEYS, ...PROGRAM_KEYS]) answers[key] = rating;
  answers.helped_develop = 'yes';
  answers.notes = `ملاحظة تجريبية ${rating}`;
  return { ...answers, ...overrides };
};

test.describe('Student survey API', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const password = 'Student123!';

  let adminToken = '';
  let student1Token = '';
  let student2Token = '';
  let student1Name = '';
  let student2Name = '';
  let student1Id = 0;
  let student2Id = 0;
  let onlineCourseId = 0;
  let offlineCourseId = 0;
  let groupA = 0; // online, completed
  let groupB = 0; // online, not completed
  let groupC = 0; // offline, completed

  const adminAuth = () => ({ Authorization: `Bearer ${adminToken}` });
  const auth1 = () => ({ Authorization: `Bearer ${student1Token}` });
  const auth2 = () => ({ Authorization: `Bearer ${student2Token}` });

  const createStudent = async (request: APIRequestContext, suffix: string) => {
    const email = uniqueEmail(`survey-${suffix}`);
    const res = await request.post('/api/admin/users', {
      headers: adminAuth(),
      data: {
        name: `طالب استبيان ${suffix} ${stamp}`,
        email,
        password,
        role_id: 3,
      },
    });
    expect(res.status()).toBe(201);
    const id = (await res.json()).id as number;
    const login = await request.post('/api/auth/login', { data: { email, password } });
    expect(login.ok()).toBeTruthy();
    return { id, token: (await login.json()).token as string, email };
  };

  const createCourse = async (request: APIRequestContext, mode: 'online' | 'offline', suffix: string) => {
    const res = await request.post('/api/courses', {
      headers: adminAuth(),
      data: {
        title_ar: `كورس استبيان ${suffix} ${stamp}`,
        title_en: `Survey Course ${suffix} ${stamp}`,
        course_mode: mode,
        max_students: 50,
        price: 0,
      },
    });
    expect(res.status()).toBe(201);
    const id = (await res.json()).id as number;
    const update = await request.put(`/api/courses/${id}`, {
      headers: adminAuth(),
      data: { prevent_overlap: 0 },
    });
    expect(update.ok()).toBeTruthy();
    return id;
  };

  const createGroup = async (
    request: APIRequestContext,
    courseId: number,
    name: string,
    studentIds: number[],
    withLecture = true,
  ) => {
    const res = await request.post('/api/groups', {
      headers: adminAuth(),
      data: { course_id: courseId, name, status: 'active' },
    });
    expect(res.status()).toBe(201);
    const id = (await res.json()).id as number;

    if (studentIds.length > 0) {
      const assign = await request.post(`/api/groups/${id}/students`, {
        headers: adminAuth(),
        data: { user_ids: studentIds },
      });
      expect(assign.ok()).toBeTruthy();
    }
    if (withLecture) {
      const lecture = await request.post(`/api/groups/${id}/lectures`, {
        headers: adminAuth(),
        data: { date: '2026-04-01', topic: `محاضرة استبيان ${stamp}` },
      });
      expect(lecture.status()).toBe(201);
    }
    return id;
  };

  test.beforeAll(async ({ request }) => {
    const adminLogin = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.ok()).toBeTruthy();
    adminToken = (await adminLogin.json()).token;

    const s1 = await createStudent(request, 'أول');
    const s2 = await createStudent(request, 'ثاني');
    student1Token = s1.token;
    student2Token = s2.token;
    student1Name = `طالب استبيان أول ${stamp}`;
    student2Name = `طالب استبيان ثاني ${stamp}`;
    student1Id = s1.id;
    student2Id = s2.id;

    onlineCourseId = await createCourse(request, 'online', 'أونلاين');
    offlineCourseId = await createCourse(request, 'offline', 'أوفلاين');

    // Create both groups before completing any of them (completion may roll to
    // a next round, which would block creating another group).
    groupA = await createGroup(request, onlineCourseId, `مجموعة استبيان أ ${stamp}`, [s1.id, s2.id]);
    groupB = await createGroup(request, onlineCourseId, `مجموعة استبيان ب ${stamp}`, [s1.id]);
    groupC = await createGroup(request, offlineCourseId, `مجموعة استبيان ج ${stamp}`, [s1.id]);

    for (const id of [groupA, groupC]) {
      const complete = await request.post(`/api/groups/${id}/complete`, { headers: adminAuth() });
      expect(complete.ok()).toBeTruthy();
    }
  });

  test.afterAll(async ({ request }) => {
    // Restore the default survey settings no matter how the tests ended.
    await request.put('/api/settings/survey', {
      headers: adminAuth(),
      data: { openDays: 30, reminder1Days: 2, reminder2Days: 5 },
    });
    for (const id of [onlineCourseId, offlineCourseId]) {
      if (id) await request.delete(`/api/courses/${id}`, { headers: adminAuth() });
    }
  });

  test('survey is not open before the group is completed', async ({ request }) => {
    const res = await request.get(`/api/surveys/my/${groupB}`, { headers: auth1() });
    expect(res.ok()).toBeTruthy();
    const survey = await res.json();
    expect(survey.status).toBe('not_open');
    expect(survey.available).toBe(false);
    expect(survey.response).toBeNull();
  });

  test('online survey shows 5 lecturer + 6 program items and no place item', async ({ request }) => {
    const res = await request.get(`/api/surveys/my/${groupA}`, { headers: auth1() });
    expect(res.ok()).toBeTruthy();
    const survey = await res.json();

    expect(survey.status).toBe('pending');
    expect(survey.available).toBe(true);
    expect(survey.group.course_mode).toBe('online');
    expect(survey.student.name).toBe(student1Name);
    expect(survey.group.course_title).toContain('كورس استبيان أونلاين');

    expect(survey.sections).toHaveLength(2);
    expect(survey.sections[0].key).toBe('lecturer');
    expect(survey.sections[0].items).toHaveLength(5);
    expect(survey.sections[1].key).toBe('program');
    expect(survey.sections[1].items).toHaveLength(6);
    expect(survey.sections[1].items.map((i: any) => i.key)).not.toContain('program_place');

    expect(survey.scale.map((s: any) => s.value)).toEqual([1, 2, 3, 4, 5]);
    expect(survey.scale[0].label).toBe('ضعيف');
    expect(survey.scale[4].label).toBe('ممتاز');
    expect(survey.helped.label).toContain('ساعدك');

    // Window = 30 days after completion by default.
    expect(survey.closes_at).toBeTruthy();
    expect(survey.days_left).toBeGreaterThanOrEqual(29);
    expect(survey.days_left).toBeLessThanOrEqual(30);
    expect(survey.response).toBeNull();
  });

  test('offline survey adds the place item', async ({ request }) => {
    const res = await request.get(`/api/surveys/my/${groupC}`, { headers: auth1() });
    expect(res.ok()).toBeTruthy();
    const survey = await res.json();
    expect(survey.group.course_mode).toBe('offline');
    const program = survey.sections.find((s: any) => s.key === 'program');
    expect(program.items.map((i: any) => i.key)).toContain('program_place');
    expect(program.items).toHaveLength(7);
  });

  test('draft is auto-saved and resumes exactly where the student stopped', async ({ request }) => {
    const draft = await request.put(`/api/surveys/my/${groupA}/draft`, {
      headers: auth1(),
      data: {
        answers: { lecturer_knowledge: 5, notes: 'مسودة غير مكتملة' },
        is_anonymous: true,
        current_step: 2,
      },
    });
    expect(draft.ok()).toBeTruthy();
    expect((await draft.json()).response.status).toBe('draft');

    const reload = await request.get(`/api/surveys/my/${groupA}`, { headers: auth1() });
    const survey = await reload.json();
    expect(survey.status).toBe('draft');
    expect(survey.response.status).toBe('draft');
    expect(survey.response.answers.lecturer_knowledge).toBe(5);
    expect(survey.response.answers.notes).toBe('مسودة غير مكتملة');
    expect(survey.response.is_anonymous).toBe(true);
    expect(survey.response.current_step).toBe(2);

    // The dashboard card lists it as a saved draft.
    const list = await request.get('/api/surveys/my', { headers: auth1() });
    expect(list.ok()).toBeTruthy();
    const items = await list.json();
    const entry = items.find((s: any) => Number(s.group_id) === groupA);
    expect(entry).toBeTruthy();
    expect(entry.status).toBe('draft');
    expect(entry.group_name).toContain('مجموعة استبيان أ');
  });

  test('submission requires all items, is final and hides the name when requested off', async ({ request }) => {
    const incomplete = await request.post(`/api/surveys/my/${groupA}/submit`, {
      headers: auth1(),
      data: { answers: { lecturer_knowledge: 5, helped_develop: 'yes' }, is_anonymous: true },
    });
    expect(incomplete.status()).toBe(400);
    expect((await incomplete.json()).error).toContain('أكمل جميع البنود');

    const submit = await request.post(`/api/surveys/my/${groupA}/submit`, {
      headers: auth1(),
      data: { answers: answersWith(5), is_anonymous: false },
    });
    expect(submit.ok()).toBeTruthy();
    const body = await submit.json();
    expect(body.response.status).toBe('submitted');
    expect(body.response.submitted_at).toBeTruthy();
    expect(body.response.is_anonymous).toBe(false);

    const after = await request.get(`/api/surveys/my/${groupA}`, { headers: auth1() });
    const survey = await after.json();
    expect(survey.status).toBe('submitted');
    expect(survey.can_edit).toBe(false);

    // One response per student, never editable afterwards.
    const second = await request.post(`/api/surveys/my/${groupA}/submit`, {
      headers: auth1(),
      data: { answers: answersWith(3), is_anonymous: false },
    });
    expect(second.status()).toBe(400);
    expect((await second.json()).error).toContain('إجابة واحدة');

    const draftAfter = await request.put(`/api/surveys/my/${groupA}/draft`, {
      headers: auth1(),
      data: { answers: answersWith(2) },
    });
    expect(draftAfter.status()).toBe(400);
  });

  test('a manual reminder reaches only the students who have not answered', async ({ request }) => {
    const remind = await request.post(`/api/surveys/group/${groupA}/remind`, {
      headers: adminAuth(),
    });
    expect(remind.ok()).toBeTruthy();
    expect((await remind.json()).sent).toBe(1);

    const s2Notifications = await request.get('/api/notifications?limit=50', { headers: auth2() });
    const s2Items = await s2Notifications.json();
    const manual = s2Items.find((n: any) => n.title === 'تذكير: قيّم دورتك');
    expect(manual).toBeTruthy();
    expect(manual.link).toBe(`/survey/${groupA}`);

    const s1Notifications = await request.get('/api/notifications?limit=50', { headers: auth1() });
    const s1Items = await s1Notifications.json();
    expect(s1Items.some((n: any) => n.link === `/survey/${groupA}` && n.title === 'تذكير: قيّم دورتك')).toBe(false);
  });

  test('admin stats show the response rate, averages and names according to the toggle', async ({ request }) => {
    const statsRes = await request.get(`/api/surveys/group/${groupA}/stats`, {
      headers: adminAuth(),
    });
    expect(statsRes.ok()).toBeTruthy();
    const stats = await statsRes.json();

    expect(stats.total_students).toBe(2);
    expect(stats.answered).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.response_rate).toBe(50);
    expect(stats.overall_avg).toBe(5);
    expect(stats.sections).toHaveLength(2);
    expect(stats.items).toHaveLength(11);
    expect(stats.items.map((i: any) => i.key)).not.toContain('program_place');

    const answered = stats.responses.find((r: any) => r.student_name === student1Name);
    expect(answered).toBeTruthy();
    expect(answered.is_anonymous).toBe(false);

    // The second student answers anonymously (name hidden).
    const submit2 = await request.post(`/api/surveys/my/${groupA}/submit`, {
      headers: auth2(),
      data: { answers: answersWith(3, { helped_develop: 'no' }), is_anonymous: true },
    });
    expect(submit2.ok()).toBeTruthy();

    const stats2 = await (await request.get(`/api/surveys/group/${groupA}/stats`, {
      headers: adminAuth(),
    })).json();
    expect(stats2.answered).toBe(2);
    expect(stats2.pending).toBe(0);
    expect(stats2.response_rate).toBe(100);
    expect(stats2.overall_avg).toBe(4);
    expect(stats2.responses).toHaveLength(2);
    const anonymous = stats2.responses.find((r: any) => r.is_anonymous);
    expect(anonymous).toBeTruthy();
    expect(anonymous.student_name).toBeNull();
    expect(stats2.helped.yes).toBe(1);
    expect(stats2.helped.no).toBe(1);
    expect(stats2.helped.yes_percent).toBe(50);

    // Results are admin-only: students never see them.
    const forbidden = await request.get(`/api/surveys/group/${groupA}/stats`, { headers: auth1() });
    expect(forbidden.status()).toBe(403);
    const anonymousCall = await request.get(`/api/surveys/group/${groupA}/stats`);
    expect(anonymousCall.status()).toBe(401);
  });

  test('the two scheduled reminders are idempotent and only reach non-responders', async ({ request }) => {
    // A fresh completed group with one answered and one pending student.
    const groupD = await createGroup(request, onlineCourseId, `مجموعة استبيان د ${stamp}`, [], false);
    const assign = await request.post(`/api/groups/${groupD}/students`, {
      headers: adminAuth(),
      data: { user_ids: [student1Id, student2Id] },
    });
    expect(assign.ok()).toBeTruthy();
    const lecture = await request.post(`/api/groups/${groupD}/lectures`, {
      headers: adminAuth(),
      data: { date: '2026-04-02', topic: `محاضرة التذكير ${stamp}` },
    });
    expect(lecture.status()).toBe(201);
    const complete = await request.post(`/api/groups/${groupD}/complete`, { headers: adminAuth() });
    expect(complete.ok()).toBeTruthy();

    // Student 1 answers groupD so only student 2 is pending.
    const submit = await request.post(`/api/surveys/my/${groupD}/submit`, {
      headers: auth1(),
      data: { answers: answersWith(4), is_anonymous: true },
    });
    expect(submit.ok()).toBeTruthy();

    // Make the first reminder due immediately and keep the second at 1 day.
    const settings = await request.put('/api/settings/survey', {
      headers: adminAuth(),
      data: { openDays: 30, reminder1Days: 0, reminder2Days: 1 },
    });
    expect(settings.ok()).toBeTruthy();

    const firstSweep = await request.post('/api/surveys/process-reminders', { headers: adminAuth() });
    expect(firstSweep.ok()).toBeTruthy();
    expect((await firstSweep.json()).reminder1).toBeGreaterThanOrEqual(1);

    const afterFirst = await (await request.get(`/api/surveys/group/${groupD}/stats`, {
      headers: adminAuth(),
    })).json();
    expect(afterFirst.group.reminder1_at).toBeTruthy();
    expect(afterFirst.group.reminder2_at).toBeNull();

    const s2Notifications = await (await request.get('/api/notifications?limit=100', { headers: auth2() })).json();
    const scheduled = s2Notifications.find((n: any) => n.title === 'تذكير بسيط: قيّم دورتك' && n.link === `/survey/${groupD}`);
    expect(scheduled).toBeTruthy();

    const s1Notifications = await (await request.get('/api/notifications?limit=100', { headers: auth1() })).json();
    expect(s1Notifications.some((n: any) => n.link === `/survey/${groupD}` && n.title === 'تذكير بسيط: قيّم دورتك')).toBe(false);

    // Re-running the sweep never sends the same reminder twice.
    const secondSweep = await request.post('/api/surveys/process-reminders', { headers: adminAuth() });
    expect(secondSweep.ok()).toBeTruthy();
    expect((await secondSweep.json()).reminder1).toBe(0);

    const afterSecond = await (await request.get(`/api/surveys/group/${groupD}/stats`, {
      headers: adminAuth(),
    })).json();
    expect(afterSecond.group.reminder1_at).toBeTruthy();
    expect(afterSecond.group.reminder2_at).toBeNull();

    // The second reminder must be scheduled after the first one.
    const invalid = await request.put('/api/settings/survey', {
      headers: adminAuth(),
      data: { openDays: 30, reminder1Days: 5, reminder2Days: 1 },
    });
    expect(invalid.status()).toBe(400);

    // Manual reminders also refuse a closed survey.
    const extendPast = await request.put(`/api/surveys/group/${groupD}/window`, {
      headers: adminAuth(),
      data: { closes_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    });
    expect(extendPast.ok()).toBeTruthy();
    const closedRemind = await request.post(`/api/surveys/group/${groupD}/remind`, {
      headers: adminAuth(),
    });
    expect(closedRemind.status()).toBe(400);
  });

  test('the window can be extended, and a closed survey rejects drafts and submissions', async ({ request }) => {
    const closesAt = new Date(Date.now() - 60 * 1000).toISOString();
    const extend = await request.put(`/api/surveys/group/${groupA}/window`, {
      headers: adminAuth(),
      data: { closes_at: closesAt },
    });
    expect(extend.ok()).toBeTruthy();

    const stats = await (await request.get(`/api/surveys/group/${groupA}/stats`, {
      headers: adminAuth(),
    })).json();
    expect(new Date(stats.group.closes_at).getTime()).toBeLessThan(Date.now());

    // Both students already answered groupA, so use groupC (answer pending).
    const closeC = await request.put(`/api/surveys/group/${groupC}/window`, {
      headers: adminAuth(),
      data: { closes_at: closesAt },
    });
    expect(closeC.ok()).toBeTruthy();

    const survey = await (await request.get(`/api/surveys/my/${groupC}`, { headers: auth1() })).json();
    expect(survey.status).toBe('closed');
    expect(survey.can_edit).toBe(false);

    const draft = await request.put(`/api/surveys/my/${groupC}/draft`, {
      headers: auth1(),
      data: { answers: answersWith(5) },
    });
    expect(draft.status()).toBe(400);
    expect((await draft.json()).error).toContain('انتهت مدة');

    const submit = await request.post(`/api/surveys/my/${groupC}/submit`, {
      headers: auth1(),
      data: { answers: answersWith(5) },
    });
    expect(submit.status()).toBe(400);

    const invalidDate = await request.put(`/api/surveys/group/${groupC}/window`, {
      headers: adminAuth(),
      data: { closes_at: 'not-a-date' },
    });
    expect(invalidDate.status()).toBe(400);
  });

  test('reopening the group closes the survey and keeps submitted answers', async ({ request }) => {
    const reopen = await request.post(`/api/groups/${groupA}/reopen`, { headers: adminAuth() });
    expect(reopen.ok()).toBeTruthy();

    const survey = await (await request.get(`/api/surveys/my/${groupA}`, { headers: auth1() })).json();
    expect(survey.status).toBe('not_open');
    expect(survey.response.status).toBe('submitted');
    expect(survey.can_edit).toBe(false);

    const stats = await (await request.get(`/api/surveys/group/${groupA}/stats`, {
      headers: adminAuth(),
    })).json();
    expect(stats.group.closes_at).toBeNull();
    expect(stats.answered).toBe(2);
  });
});
