import crypto from 'crypto';
import { sql } from '../db/helpers';
import { createNotification } from './notificationService';
import { sendNotification, notifyGroupStudents as notifyGroupStudentsExt } from './externalNotificationService';
import { openSurveyWindow, resetSurveyWindow } from './surveyService';

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function formatRow(r: any): any {
  const out = { ...r };
  for (const k of ['id', 'course_id', 'is_active', 'is_complete', 'max_students', 'sort_order', 'place_id', 'place_capacity']) {
    if (out[k] !== undefined && out[k] !== null) out[k] = Number(out[k]);
  }
  return out;
}

// ──────────────────────────────────────────────
// Places (rooms) — capacity is a hard limit
// ──────────────────────────────────────────────

interface PlaceInfo {
  id: number;
  name: string;
  capacity: number;
  is_active: number;
}

async function loadPlace(placeId: number): Promise<PlaceInfo | null> {
  const result = await sql('SELECT id, name, capacity, is_active FROM places WHERE id=?', placeId);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as any;
  return {
    id: Number(row.id),
    name: row.name,
    capacity: Number(row.capacity),
    is_active: Number(row.is_active),
  };
}

async function getStudentCount(groupId: number): Promise<number> {
  const result = await sql('SELECT COUNT(*) as cnt FROM group_students WHERE group_id=?', groupId);
  return Number(result.rows[0]?.cnt || 0);
}

/**
 * The hard capacity of a group: the room capacity when the group is linked to a
 * place (never above it), otherwise the group's own max_students.
 */
async function getGroupCapacity(groupId: number): Promise<{
  max: number | null;
  place: PlaceInfo | null;
  groupName: string;
  students: number;
}> {
  const result = await sql(
    `SELECT g.name, g.max_students, p.id as place_id, p.name as place_name,
            p.capacity as place_capacity, p.is_active as place_active
     FROM groups g LEFT JOIN places p ON g.place_id=p.id WHERE g.id=?`,
    groupId,
  );
  if (result.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const row = result.rows[0] as any;
  const place: PlaceInfo | null = row.place_id == null
    ? null
    : {
        id: Number(row.place_id),
        name: row.place_name,
        capacity: Number(row.place_capacity),
        is_active: Number(row.place_active),
      };
  const own = row.max_students == null ? null : Number(row.max_students);
  const max = place ? (own == null ? place.capacity : Math.min(own, place.capacity)) : own;
  return {
    max,
    place,
    groupName: row.name,
    students: await getStudentCount(groupId),
  };
}

/**
 * Reject an assignment that would push the group over its capacity.
 * `adding` is the number of students the caller intends to insert.
 */
async function assertCapacity(groupId: number, adding: number): Promise<void> {
  const capacity = await getGroupCapacity(groupId);
  if (capacity.max != null && capacity.students + adding > capacity.max) {
    const remaining = Math.max(capacity.max - capacity.students, 0);
    const where = capacity.place ? ` في المكان "${capacity.place.name}"` : '';
    throw {
      status: 400,
      message: remaining === 0
        ? `المجموعة "${capacity.groupName}" ممتلئة (السعة ${capacity.max}${where}) — لا يمكن إضافة طلاب جدد`
        : `السعة المتاحة${where} ${remaining} طالب فقط، والمطلوب إضافة ${adding}`,
    };
  }
}

function getDayFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return String(d.getDay());
}

function getDayNameFromDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return DAY_NAMES_AR[d.getDay()] || '';
}

// ──────────────────────────────────────────────
// Rule helpers
// ──────────────────────────────────────────────

async function groupHasStarted(groupId: number): Promise<boolean> {
  const result = await sql(
    'SELECT COUNT(*) as cnt FROM lectures WHERE group_id=? AND is_completed=1',
    groupId,
  );
  return Number(result.rows[0].cnt) > 0;
}

async function isStudentInCourseGroup(studentId: number, courseId: number, excludeGroupId?: number): Promise<{ inGroup: boolean; groupName?: string }> {
  let query = `SELECT g.name FROM group_students gs JOIN groups g ON gs.group_id=g.id WHERE gs.user_id=? AND g.course_id=?`;
  const params: any[] = [studentId, courseId];
  if (excludeGroupId) { query += ' AND gs.group_id!=?'; params.push(excludeGroupId); }
  query += ' LIMIT 1';
  const result = await sql(query, ...params);
  if (result.rows.length > 0) {
    return { inGroup: true, groupName: (result.rows[0] as any).name };
  }
  return { inGroup: false };
}

async function checkPendingExists(courseId: number, excludeGroupId?: number): Promise<boolean> {
  let query = "SELECT COUNT(*) as cnt FROM groups WHERE course_id=? AND status='pending'";
  const params: any[] = [courseId];
  if (excludeGroupId) { query += ' AND id!=?'; params.push(excludeGroupId); }
  const result = await sql(query, ...params);
  return Number(result.rows[0].cnt) > 0;
}

async function checkPreventOverlap(courseId: number, excludeGroupId?: number): Promise<boolean> {
  const course = await sql('SELECT prevent_overlap FROM courses WHERE id=?', courseId);
  if (course.rows.length === 0) return false;
  if (!Number((course.rows[0] as any).prevent_overlap)) return false;
  let query = 'SELECT COUNT(*) as cnt FROM groups WHERE course_id=? AND is_active=1';
  const params: any[] = [courseId];
  if (excludeGroupId) { query += ' AND id!=?'; params.push(excludeGroupId); }
  const result = await sql(query, ...params);
  return Number(result.rows[0].cnt) > 0;
}

// ──────────────────────────────────────────────
// Status helpers
// ──────────────────────────────────────────────
async function recalcStatus(groupId: number): Promise<void> {
  const old = await sql('SELECT is_complete, status FROM groups WHERE id=?', groupId);
  if (old.rows.length === 0) return;
  const row = old.rows[0] as any;

  // Completion (and cancellation) are explicit admin decisions. Lectures,
  // attendance or edits must never complete or reopen a group on their own.
  if (row.status === 'cancelled' || row.status === 'completed' || Number(row.is_complete)) return;

  const lec = await sql('SELECT COUNT(*) as total FROM lectures WHERE group_id=?', groupId);
  const total = Number(lec.rows[0].total);
  const status = total === 0 ? 'pending' : 'active';
  await sql('UPDATE groups SET status=?, is_active=1 WHERE id=?', status, groupId);

  // Sync start_date from earliest lecture
  const dates = await sql(
    'SELECT MIN(date) as first_date FROM lectures WHERE group_id=? AND date IS NOT NULL',
    groupId,
  );
  const firstDate = dates.rows.length > 0 ? (dates.rows[0] as any).first_date : null;
  if (firstDate) {
    await sql('UPDATE groups SET start_date=? WHERE id=?', firstDate, groupId);
  }
}

/**
 * When completion unlocks a new round for the course (prevent_overlap), open a
 * fresh pending group so new students have a place to be assigned.
 */
async function createNextGroupIfNeeded(courseId: number): Promise<number | null> {
  const course = await sql('SELECT prevent_overlap, instructor, max_students FROM courses WHERE id=?', courseId);
  if (course.rows.length === 0 || !Number((course.rows[0] as any).prevent_overlap)) return null;

  const groupCount = await sql(
    "SELECT COUNT(*) as cnt FROM groups WHERE course_id=? AND name LIKE 'مجموعة%'",
    courseId,
  );
  const nextNum = Number(groupCount.rows[0].cnt) + 1;
  const instructor = (course.rows[0] as any).instructor || '';
  const maxStudents = (course.rows[0] as any).max_students || null;

  const created = await sql(
    `INSERT INTO groups (course_id, name, instructor_name, max_students, status, is_active)
     VALUES (?,?,?,?,'pending',1)`,
    courseId, `مجموعة ${nextNum}`, instructor, maxStudents,
  );
  return Number(created.lastInsertRowid);
}

/** Groups that are officially finished accept no new students and no new lectures. */
async function assertGroupOpen(groupId: number, action: string): Promise<void> {
  const result = await sql('SELECT name, status, is_complete, completed_at FROM groups WHERE id=?', groupId);
  if (result.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const row = result.rows[0] as any;
  if (row.status === 'completed' || Number(row.is_complete) || row.completed_at) {
    throw {
      status: 400,
      message: `المجموعة "${row.name}" منتهية — أعد فتحها أولاً قبل ${action}`,
    };
  }
}

// ──────────────────────────────────────────────
// Auto-issue certificates when group completes
// ──────────────────────────────────────────────
async function autoIssueCertificates(groupId: number, courseId: number): Promise<number> {
  // 1. Read certificate settings
  let certSettings: any = { autoIssue: true, requireAttendance: true, minAttendancePercent: 80 };
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='certificate'");
    if (result.rows.length > 0) {
      certSettings = { ...certSettings, ...JSON.parse(result.rows[0].value as string) };
    }
  } catch { /* use defaults */ }

  if (!certSettings.autoIssue) {
    console.log('[Certificate] Auto-issue is disabled in settings');
    return 0;
  }

  // 2. Get all students in this group who have paid orders for this course
  const studentsResult = await sql(
    `SELECT DISTINCT gs.user_id
     FROM group_students gs
     JOIN orders o ON o.user_id = gs.user_id AND o.status = 'paid'
     JOIN order_items oi ON oi.order_id = o.id AND oi.course_id = ?
     WHERE gs.group_id = ?`,
    courseId, groupId,
  );

  const students = studentsResult.rows as any[];
  console.log(`[Certificate] Auto-issue: ${students.length} eligible students in group ${groupId}`);

  // 3. Get total lectures in this group
  const totalResult = await sql(
    'SELECT COUNT(*) as total FROM lectures WHERE group_id=?',
    groupId,
  );
  const totalLectures = Number(totalResult.rows[0].total);

  // 4. Process each student
  let issuedCount = 0;
  for (const row of students) {
    const userId = row.user_id;

    // Check if certificate already exists
    const exists = await sql(
      'SELECT id FROM certificates WHERE user_id=? AND course_id=?',
      userId, courseId,
    );
    if (exists.rows.length > 0) {
      console.log(`[Certificate] Student ${userId} already has certificate for course ${courseId}`);
      continue;
    }

    // Check attendance if required
    if (certSettings.requireAttendance && totalLectures > 0) {
      const attendedResult = await sql(
        `SELECT COUNT(*) as attended
         FROM lecture_attendance la
         JOIN lectures l ON la.lecture_id = l.id
         WHERE l.group_id = ? AND la.user_id = ? AND la.attended = 1`,
        groupId, userId,
      );
      const attended = Number(attendedResult.rows[0].attended);
      const percent = (attended / totalLectures) * 100;

      if (percent < (certSettings.minAttendancePercent || 80)) {
        console.log(`[Certificate] Student ${userId} attendance ${Math.round(percent)}% < ${certSettings.minAttendancePercent || 80}% — skipped`);
        continue;
      }
    }

    // Issue certificate
    const serialId = crypto.randomBytes(8).toString('hex').toUpperCase();
    await sql(
      'INSERT INTO certificates (user_id, course_id, serial_id) VALUES (?,?,?)',
      userId, courseId, serialId,
    );

    // Get course title for notification
    const courseData = await sql('SELECT title_ar FROM courses WHERE id=?', courseId);
    const courseTitle = courseData.rows.length > 0 ? (courseData.rows[0] as any).title_ar : '';

    // Send notification
    await sendNotification(userId, 'certificate_issued', { courseTitle, serialId })
      .catch(e => console.error('[Notify] certificate_issued failed:', e.message));

    issuedCount++;
    console.log(`[Certificate] Issued certificate ${serialId} for student ${userId} in course ${courseId}`);
  }

  console.log(`[Certificate] Auto-issue complete: ${issuedCount} certificates issued for group ${groupId}`);
  return issuedCount;
}

// ──────────────────────────────────────────────
// Enrich a single group
// ──────────────────────────────────────────────
async function enrich(group: any): Promise<any> {
  group = formatRow(group);
  const lecs = await sql(
    'SELECT * FROM lectures WHERE group_id=? ORDER BY sort_order ASC, id ASC',
    group.id,
  );
  const all = lecs.rows as any[];
  group.schedule_display = all.length > 0
    ? `${getDayNameFromDate(all[0].date)} ${all[0].date || ''} ${all[0].time_from || ''}-${all[0].time_to || ''}`
    : 'لم يتم تحديد الميعاد بعد';
  group.next_lecture = all.find((l: any) => !Number(l.is_completed)) || null;
  const total = all.length;
  const done = all.filter((l: any) => Number(l.is_completed)).length;
  group.lecture_progress = { total, done };
  const cnt = await sql('SELECT COUNT(*) as cnt FROM group_students WHERE group_id=?', group.id);
  group.student_count = Number(cnt.rows[0].cnt);
  group.has_started = all.some((l: any) => Number(l.is_completed));
  return group;
}

// ──────────────────────────────────────────────
// Student history helper
// ──────────────────────────────────────────────
async function addHistory(userId: number, groupId: number, action: string, movedBy?: number) {
  await sql(
    'INSERT INTO group_student_history (user_id, group_id, action, moved_by) VALUES (?,?,?,?)',
    userId, groupId, action, movedBy || null,
  );
}

// ──────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────

export async function getGroups(courseId?: number): Promise<any[]> {
  let query = `SELECT g.*, c.title_ar as course_name, p.name as place_name, p.capacity as place_capacity,
                      p.is_active as place_is_active, u.name as completed_by_name
               FROM groups g
               JOIN courses c ON g.course_id=c.id
               LEFT JOIN places p ON g.place_id=p.id
               LEFT JOIN users u ON g.completed_by=u.id`;
  const params: unknown[] = [];
  if (courseId) { query += ' WHERE g.course_id=?'; params.push(courseId); }
  query += ' ORDER BY g.created_at DESC';
  const result = await sql(query, ...params);
  return Promise.all(result.rows.map(enrich));
}

export async function getGroupById(id: number): Promise<any | null> {
  const result = await sql(
    `SELECT g.*, c.title_ar as course_name, p.name as place_name, p.capacity as place_capacity,
            p.is_active as place_is_active, u.name as completed_by_name
     FROM groups g
     JOIN courses c ON g.course_id=c.id
     LEFT JOIN places p ON g.place_id=p.id
     LEFT JOIN users u ON g.completed_by=u.id
     WHERE g.id=?`,
    id,
  );
  if (result.rows.length === 0) return null;
  return enrich(result.rows[0] as any);
}

// ──────────────────────────────────────────────
// Manual group completion (edit-plan.md §4.2)
// ──────────────────────────────────────────────

/**
 * Officially finish a group. This is the only way a group becomes completed:
 * it opens the post-course flow (survey / instructor evaluation / final report
 * in later phases), stops new assignments, issues certificates to eligible
 * students and notifies the students. Reversible with `reopenGroup`.
 */
export async function completeGroup(
  groupId: number,
  adminId?: number,
): Promise<{ students: number; certificates: number }> {
  const result = await sql(
    `SELECT g.id, g.name, g.status, g.is_complete, g.completed_at, g.course_id,
            g.instructor_user_id, c.title_ar as course_title
     FROM groups g JOIN courses c ON g.course_id=c.id WHERE g.id=?`,
    groupId,
  );
  if (result.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const group = result.rows[0] as any;

  if (group.status === 'cancelled') {
    throw { status: 400, message: 'لا يمكن إنهاء مجموعة ملغية — أعد تفعيلها أولاً' };
  }
  if (group.status === 'completed' || Number(group.is_complete) || group.completed_at) {
    throw { status: 400, message: 'المجموعة منتهية بالفعل' };
  }

  const lectures = await sql('SELECT COUNT(*) as total FROM lectures WHERE group_id=?', groupId);
  if (Number(lectures.rows[0].total) === 0) {
    throw { status: 400, message: 'أضف محاضرة واحدة على الأقل قبل إنهاء المجموعة' };
  }

  await sql(
    `UPDATE groups SET is_complete=1, status='completed', is_active=0,
            completed_at=datetime('now'), completed_by=?, instructor_eval_opened_at=datetime('now') WHERE id=?`,
    adminId ?? null, groupId,
  );

  const studentsResult = await sql('SELECT user_id FROM group_students WHERE group_id=?', groupId);
  const studentIds = studentsResult.rows.map((r: any) => Number(r.user_id));

  // In-app notification through the existing notification system (bell).
  for (const userId of studentIds) {
    await createNotification(
      userId,
      'انتهت مجموعتك',
      `انتهت مجموعة "${group.name}" في كورس "${group.course_title}" — شكراً لمشاركتك!`,
      'success',
      '/my-courses',
    ).catch(e => console.error('[Notify] group_completed in-app failed:', e.message));
  }
  // Email + Telegram (same optional channels as the rest of the platform).
  await notifyGroupStudentsExt(groupId, 'group_completed', {
    courseTitle: group.course_title || '',
    groupName: group.name || '',
  }).catch(e => console.error('[Notify] group_completed failed:', e.message));

  // Open the post-course survey window and invite the students to fill it in.
  await openSurveyWindow(groupId).catch(e =>
    console.error('[Survey] Failed to open survey window for group', groupId, ':', e.message),
  );
  for (const userId of studentIds) {
    await createNotification(
      userId,
      'قيّم دورتك',
      `رأيك في مجموعة "${group.name}" يساعدنا على التحسين — يستغرق نحو دقيقتين فقط.`,
      'info',
      `/survey/${groupId}`,
    ).catch(e => console.error('[Notify] survey_opened in-app failed:', e.message));
  }
  await notifyGroupStudentsExt(groupId, 'survey_opened', {
    groupId,
    courseTitle: group.course_title || '',
    groupName: group.name || '',
  }).catch(e => console.error('[Notify] survey_opened failed:', e.message));

  // The group's linked instructor account is invited to evaluate its students.
  if (group.instructor_user_id) {
    const instructorId = Number(group.instructor_user_id);
    await createNotification(
      instructorId,
      'تقييم الطلاب متاح',
      `تم فتح تقييم طلاب مجموعة "${group.name}" في كورس "${group.course_title}".`,
      'info',
      '/instructor',
    ).catch(e => console.error('[Notify] instructor_eval_opened in-app failed:', e.message));
    await sendNotification(instructorId, 'instructor_eval_opened', {
      groupId,
      courseTitle: group.course_title || '',
      groupName: group.name || '',
    }).catch(e => console.error('[Notify] instructor_eval_opened failed:', e.message));
  }

  const certificates = await autoIssueCertificates(groupId, Number(group.course_id)).catch(e => {
    console.error('[Certificate] Auto-issue failed for group', groupId, ':', e.message);
    return 0;
  });

  await createNextGroupIfNeeded(Number(group.course_id)).catch(e =>
    console.error('[Groups] Next group creation failed:', e.message),
  );

  return { students: studentIds.length, certificates };
}

/** Undo an official completion so the group can run again (certificates stay). */
export async function reopenGroup(groupId: number): Promise<void> {
  const result = await sql('SELECT name, status, is_complete, completed_at FROM groups WHERE id=?', groupId);
  if (result.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const group = result.rows[0] as any;
  if (group.status !== 'completed' && !Number(group.is_complete) && !group.completed_at) {
    throw { status: 400, message: 'المجموعة غير منتهية' };
  }

  const lectures = await sql('SELECT COUNT(*) as total FROM lectures WHERE group_id=?', groupId);
  const status = Number(lectures.rows[0].total) === 0 ? 'pending' : 'active';
  await sql(
    `UPDATE groups SET is_complete=0, status=?, is_active=1, completed_at=NULL, completed_by=NULL,
            instructor_eval_opened_at=NULL WHERE id=?`,
    status, groupId,
  );
  // The survey belongs to the completed run: reopening closes it. Answers that
  // were already submitted are kept untouched.
  await resetSurveyWindow(groupId).catch(e =>
    console.error('[Survey] Failed to reset survey window for group', groupId, ':', e.message),
  );
}

/** An instructor account is an active user whose role is `instructor`. */
async function loadInstructorAccount(
  userId: number,
): Promise<{ id: number; name: string }> {
  const result = await sql(
    `SELECT u.id, u.name FROM users u JOIN roles r ON u.role_id=r.id
     WHERE u.id=? AND u.is_active=1 AND r.name='instructor'`,
    userId,
  );
  if (result.rows.length === 0) {
    throw { status: 400, message: 'حساب المحاضر غير موجود أو غير مفعّل' };
  }
  return result.rows[0] as any;
}

export async function createGroup(data: {
  course_id: number;
  name: string;
  zoom_link?: string;
  end_date?: string;
  instructor_name?: string;
  instructor_user_id?: number | null;
  location?: string;
  place_id?: number | null;
  max_students?: number | null;
  status?: string;
}): Promise<number> {
  const {
    course_id, name, zoom_link, end_date, instructor_name, instructor_user_id,
    location, place_id, max_students, status,
  } = data;
  if (!name) throw { status: 400, message: 'Group name required' };

  // A linked instructor account owns the display name.
  let instructorAccount: { id: number; name: string } | null = null;
  if (instructor_user_id != null) {
    instructorAccount = await loadInstructorAccount(Number(instructor_user_id));
  }

  // A group linked to a place can never exceed that place's capacity.
  let place: PlaceInfo | null = null;
  if (place_id != null && place_id !== undefined) {
    const courseMode = await sql('SELECT course_mode FROM courses WHERE id=?', course_id);
    if (courseMode.rows.length > 0 && (courseMode.rows[0] as any).course_mode !== 'offline') {
      throw { status: 400, message: 'اختيار المكان متاح للمجموعات الأوفلاين فقط' };
    }
    place = await loadPlace(Number(place_id));
    if (!place) throw { status: 400, message: 'المكان المحدد غير موجود' };
    if (!place.is_active) throw { status: 400, message: `المكان "${place.name}" غير مفعّل` };
  }
  const requestedMax = max_students == null || Number(max_students) <= 0 ? null : Number(max_students);
  if (place && requestedMax != null && requestedMax > place.capacity) {
    throw {
      status: 400,
      message: `سعة المجموعة لا يمكن أن تتجاوز سعة المكان "${place.name}" (${place.capacity})`,
    };
  }
  const effectiveMax = place ? (requestedMax == null ? place.capacity : requestedMax) : requestedMax;

  // Auto-fill instructor from course if not provided
  let instructor = instructorAccount?.name || instructor_name || '';
  if (!instructor) {
    const course = await sql('SELECT instructor FROM courses WHERE id=?', course_id);
    if (course.rows.length > 0) instructor = (course.rows[0] as any).instructor || '';
  }

  // Prevent duplicate pending groups for the same course
  const hasPending = await checkPendingExists(course_id);
  if (hasPending) throw { status: 400, message: 'يوجد مجموعة قيد الانتظار بالفعل لهذا الكورس' };

  if (status === 'completed') {
    throw { status: 400, message: 'لا يمكن إنشاء مجموعة منتهية — استخدم زر "إنهاء المجموعة" بعد إضافتها' };
  }
  const groupStatus = ['active', 'cancelled'].includes(status || '') ? status : 'pending';
  const hasOverlap = await checkPreventOverlap(course_id);
  const isActive = hasOverlap ? 0 : 1;

  const result = await sql(
    `INSERT INTO groups (course_id, name, zoom_link, end_date, instructor_name, instructor_user_id, location, place_id, max_students, status, is_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    course_id, name, zoom_link || null, end_date || null,
    instructor, instructorAccount?.id ?? null,
    location || place?.name || null, place?.id ?? null, effectiveMax, groupStatus, isActive,
  );
  return Number(result.lastInsertRowid);
}

export async function updateGroup(id: number, data: {
  name?: string;
  zoom_link?: string;
  end_date?: string;
  instructor_name?: string;
  instructor_user_id?: number | null;
  location?: string;
  place_id?: number | null;
  max_students?: number | null;
  is_active?: number;
  status?: string;
  activity_type?: string;
  report_notes?: string;
  report_recommendations?: string;
}): Promise<void> {
  if (data.status === 'completed') {
    throw { status: 400, message: 'لا يمكن تعيين الحالة "مكتملة" يدوياً — استخدم زر "إنهاء المجموعة"' };
  }
  const currentGroup = await sql('SELECT status, is_complete, completed_at FROM groups WHERE id=?', id);
  if (currentGroup.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const currentRow = currentGroup.rows[0] as any;
  if ((currentRow.status === 'completed' || Number(currentRow.is_complete) || currentRow.completed_at) && data.status !== undefined) {
    throw { status: 400, message: 'المجموعة منتهية — أعد فتحها أولاً قبل تغيير حالتها' };
  }

  const sets: string[] = [];
  const params: any[] = [];

  // Changing the place must respect both the new room's capacity and the
  // students already registered in this group.
  let effectivePlaceCapacity: number | null = null;
  let effectivePlaceName = '';
  const changingPlace = data.place_id !== undefined;
  if (changingPlace) {
    const current = await sql(
      `SELECT g.place_id, c.course_mode FROM groups g
       JOIN courses c ON g.course_id=c.id WHERE g.id=?`,
      id,
    );
    if (current.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
    const currentPlaceId = (current.rows[0] as any).place_id;
    const nextPlaceId = data.place_id == null ? null : Number(data.place_id);

    if (nextPlaceId != null && nextPlaceId !== Number(currentPlaceId)) {
      if ((current.rows[0] as any).course_mode !== 'offline') {
        throw { status: 400, message: 'اختيار المكان متاح للمجموعات الأوفلاين فقط' };
      }
      const place = await loadPlace(nextPlaceId);
      if (!place) throw { status: 400, message: 'المكان المحدد غير موجود' };
      if (!place.is_active) throw { status: 400, message: `المكان "${place.name}" غير مفعّل` };
      const students = await getStudentCount(id);
      if (students > place.capacity) {
        throw {
          status: 400,
          message: `لا يمكن اختيار المكان "${place.name}" لأن سعته ${place.capacity} وعدد المسجلين في المجموعة ${students}`,
        };
      }
      effectivePlaceCapacity = place.capacity;
      effectivePlaceName = place.name;
    } else if (nextPlaceId != null) {
      const place = await loadPlace(nextPlaceId);
      if (place) {
        effectivePlaceCapacity = place.capacity;
        effectivePlaceName = place.name;
      }
    }
  } else {
    // Even without touching place_id, a max_students update must respect the
    // capacity of the place the group is already linked to.
    const current = await sql(
      `SELECT p.capacity as place_capacity, p.name as place_name
       FROM groups g LEFT JOIN places p ON g.place_id=p.id WHERE g.id=?`,
      id,
    );
    if (current.rows.length > 0 && (current.rows[0] as any).place_capacity != null) {
      effectivePlaceCapacity = Number((current.rows[0] as any).place_capacity);
      effectivePlaceName = (current.rows[0] as any).place_name || '';
    }
  }

  if (data.max_students !== undefined && effectivePlaceCapacity != null) {
    const requested = data.max_students == null ? null : Number(data.max_students);
    if (requested != null && requested > effectivePlaceCapacity) {
      throw {
        status: 400,
        message: `سعة المجموعة لا يمكن أن تتجاوز سعة المكان "${effectivePlaceName}" (${effectivePlaceCapacity})`,
      };
    }
    if (requested != null && requested < (await getStudentCount(id))) {
      throw {
        status: 400,
        message: `لا يمكن تقليل سعة المجموعة إلى ${requested} وعدد المسجلين الحالي أكبر`,
      };
    }
  }

  if (data.instructor_user_id !== undefined) {
    if (data.instructor_user_id == null) {
      sets.push('instructor_user_id=?');
      params.push(null);
    } else {
      const account = await loadInstructorAccount(Number(data.instructor_user_id));
      sets.push('instructor_user_id=?', 'instructor_name=?');
      params.push(account.id, account.name);
    }
  }

  const fields: (keyof typeof data)[] = ['name', 'zoom_link', 'end_date', 'instructor_name', 'location', 'place_id', 'max_students', 'is_active', 'status', 'activity_type', 'report_notes', 'report_recommendations'];
  for (const f of fields) {
    if (data[f] !== undefined) {
      if (f === 'place_id') {
        sets.push('place_id=?');
        params.push(data.place_id == null ? null : Number(data.place_id));
        // Picking a place fills the group capacity with the room capacity.
        if (data.max_students === undefined && effectivePlaceCapacity != null) {
          sets.push('max_students=?');
          params.push(effectivePlaceCapacity);
        }
        continue;
      }
      sets.push(`${f}=?`); params.push(data[f]);
    }
  }
  if (data.place_id !== undefined && effectivePlaceCapacity != null && data.location === undefined) {
    sets.push('location=?');
    params.push(effectivePlaceName);
  }
  if (data.status !== undefined && data.is_active === undefined) {
    const isActive = ['active', 'pending'].includes(data.status!) ? 1 : 0;
    sets.push('is_active=?'); params.push(isActive);
  }
  if (sets.length === 0) return;
  params.push(id);
  await sql(`UPDATE groups SET ${sets.join(', ')} WHERE id=?`, ...params);
  await recalcStatus(id);
}

export async function deleteGroup(id: number): Promise<void> {
  const safeDelete = async (query: string, ...params: any[]) => {
    try { await sql(query, ...params); } catch { /* table may not exist */ }
  };
  await safeDelete('DELETE FROM group_student_history WHERE group_id=?', id);
  await safeDelete('DELETE FROM lecture_attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE group_id=?)', id);
  await safeDelete('DELETE FROM lectures WHERE group_id=?', id);
  await safeDelete('DELETE FROM group_students WHERE group_id=?', id);
  await sql('DELETE FROM groups WHERE id=?', id);
}

// ──────────────────────────────────────────────
// Batch operations
// ──────────────────────────────────────────────

export async function batchDeleteGroups(ids: number[]): Promise<number> {
  let deleted = 0;
  for (const id of ids) {
    try { await deleteGroup(id); deleted++; } catch { /* skip failed */ }
  }
  return deleted;
}

export async function batchUpdateGroupStatus(ids: number[], status: string): Promise<number> {
  if (status === 'completed') {
    throw { status: 400, message: 'لا يمكن تعيين الحالة "مكتملة" يدوياً — استخدم زر "إنهاء المجموعة"' };
  }
  if (!['active', 'cancelled', 'pending'].includes(status)) {
    throw { status: 400, message: `Invalid status: ${status}` };
  }
  const isActive = ['active', 'pending'].includes(status) ? 1 : 0;
  let updated = 0;
  for (const id of ids) {
    try {
      const current = await sql('SELECT status, is_complete, completed_at FROM groups WHERE id=?', id);
      if (current.rows.length > 0) {
        const row = current.rows[0] as any;
        if (row.status === 'completed' || Number(row.is_complete) || row.completed_at) continue;
      }
      await sql('UPDATE groups SET status=?, is_active=? WHERE id=?', status, isActive, id);
      await recalcStatus(id);
      updated++;
    } catch { /* skip */ }
  }
  return updated;
}

export async function batchUpdateGroupInstructor(ids: number[], instructorName: string): Promise<number> {
  let updated = 0;
  for (const id of ids) {
    try {
      await sql('UPDATE groups SET instructor_name=? WHERE id=?', instructorName, id);
      updated++;
    } catch { /* skip */ }
  }
  return updated;
}

// ──────────────────────────────────────────────
// Students
// ──────────────────────────────────────────────

export async function getGroupStudents(groupId: number): Promise<any[]> {
  const result = await sql(
    `SELECT u.id, u.name, u.email, u.phone FROM group_students gs
     JOIN users u ON gs.user_id=u.id WHERE gs.group_id=?`,
    groupId,
  );
  return result.rows.map(formatRow);
}

export async function addStudentsToGroup(groupId: number, userIds: number[], movedBy?: number): Promise<number> {
  await assertGroupOpen(groupId, 'إضافة طلاب');
  const hasStarted = await groupHasStarted(groupId);
  if (hasStarted) throw { status: 400, message: 'لا يمكن التسكين في مجموعة بدأت بالفعل — تمتلك محاضرات مسجلة' };

  const capacity = await getGroupCapacity(groupId);
  if (capacity.students >= (capacity.max ?? Infinity)) {
    const where = capacity.place ? ` في المكان "${capacity.place.name}"` : '';
    throw {
      status: 400,
      message: `المجموعة "${capacity.groupName}" ممتلئة (السعة ${capacity.max}${where}) — لا يمكن إضافة طلاب جدد`,
    };
  }

  // Get course_id for duplicate check
  const grpInfo = await sql('SELECT course_id FROM groups WHERE id=?', groupId);
  const courseGroupId = grpInfo.rows.length > 0 ? Number((grpInfo.rows[0] as any).course_id) : null;

  let added = 0;
  for (const userId of userIds) {
    const exists = await sql(
      'SELECT 1 FROM group_students WHERE group_id=? AND user_id=?',
      groupId, userId,
    );
    if (exists.rows.length === 0) {
      // Check if student is already in another group for the same course
      if (courseGroupId) {
        const dupCheck = await isStudentInCourseGroup(userId, courseGroupId, groupId);
        if (dupCheck.inGroup) {
          console.log(`Skipping user ${userId}: already in group "${dupCheck.groupName}" for course ${courseGroupId}`);
          continue;
        }
      }
      if (capacity.max != null && capacity.students + added >= capacity.max) {
        const where = capacity.place ? ` في المكان "${capacity.place.name}"` : '';
        throw {
          status: 400,
          message: `تمت إضافة ${added} طالب ثم امتلأت سعة المجموعة (${capacity.max}${where}). لم يُضف بقية الطلاب`,
        };
      }
      await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', groupId, userId);
      await addHistory(userId, groupId, 'assigned', movedBy);
      // Get group info for notification
      const grp = await sql('SELECT name, course_id, instructor_name, location, start_date, end_date FROM groups WHERE id=?', groupId);
      if (grp.rows.length > 0) {
        const g = grp.rows[0] as any;
        const course = await sql('SELECT title_ar FROM courses WHERE id=?', g.course_id);
        const courseName = course.rows.length > 0 ? (course.rows[0] as any).title_ar : '';
        await createNotification(userId, 'تم إضافتك إلى مجموعة', `تم إضافتك إلى مجموعة "${g.name}" في كورس "${courseName}"`, 'success', `/dashboard`);
        // External notification (email + telegram)
        await sendNotification(userId, 'assigned_to_group', {
          groupId,
          courseTitle: courseName,
          groupName: g.name || '',
          instructor: g.instructor_name || undefined,
          location: g.location || undefined,
          startDate: g.start_date || undefined,
          endDate: g.end_date || undefined,
        }).catch(e => console.error('[Notify] assigned_to_group failed:', e.message));
      }
      added++;
    }
  }
  return added;
}

export async function removeStudentFromGroup(groupId: number, userId: number, movedBy?: number): Promise<void> {
  // Get group info before removal for notification
  const grp = await sql('SELECT name, course_id FROM groups WHERE id=?', groupId);
  await sql('DELETE FROM group_students WHERE group_id=? AND user_id=?', groupId, userId);
  await addHistory(userId, groupId, 'removed', movedBy);
  // External notification (email + telegram)
  if (grp.rows.length > 0) {
    const g = grp.rows[0] as any;
    const course = await sql('SELECT title_ar FROM courses WHERE id=?', g.course_id);
    const courseName = course.rows.length > 0 ? (course.rows[0] as any).title_ar : '';
    await sendNotification(userId, 'removed_from_group', {
      courseTitle: courseName,
      groupName: g.name || '',
    }).catch(e => console.error('[Notify] removed_from_group failed:', e.message));
  }
}

export async function moveStudent(sourceGroupId: number, userId: number, targetGroupId: number, movedBy?: number): Promise<void> {
  await assertGroupOpen(sourceGroupId, 'نقل الطالب من هذه المجموعة');
  await assertGroupOpen(targetGroupId, 'النقل إلى هذه المجموعة');
  // Verify source group exists
  const src = await sql('SELECT course_id FROM groups WHERE id=?', sourceGroupId);
  if (src.rows.length === 0) throw { status: 404, message: 'Source group not found' };
  const srcCourseId = Number((src.rows[0] as any).course_id);

  // Verify target group exists, same course, and has capacity
  const tgt = await sql('SELECT course_id, max_students FROM groups WHERE id=? AND is_active=1', targetGroupId);
  if (tgt.rows.length === 0) throw { status: 404, message: 'Target group not found or inactive' };
  const tgtCourseId = Number((tgt.rows[0] as any).course_id);

  // Check if target group has started
  const targetHasStarted = await groupHasStarted(targetGroupId);
  if (targetHasStarted) throw { status: 400, message: 'لا يمكن نقل طالب إلى مجموعة بدأت بالفعل' };
  if (srcCourseId !== tgtCourseId) throw { status: 400, message: 'Groups must belong to the same course' };

  const count = await sql('SELECT COUNT(*) as cnt FROM group_students WHERE group_id=?', targetGroupId);
  const maxStudents = (tgt.rows[0] as any).max_students;
  if (maxStudents && Number(count.rows[0].cnt) >= Number(maxStudents)) {
    throw { status: 400, message: 'Target group is full' };
  }

  await sql('DELETE FROM group_students WHERE group_id=? AND user_id=?', sourceGroupId, userId);
  await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', targetGroupId, userId);
  await addHistory(userId, sourceGroupId, 'moved_from', movedBy);
  await addHistory(userId, targetGroupId, 'moved_to', movedBy);

  // External notification (email + telegram)
  const srcGrp = await sql('SELECT name, course_id FROM groups WHERE id=?', sourceGroupId);
  const tgtGrp = await sql('SELECT name FROM groups WHERE id=?', targetGroupId);
  if (srcGrp.rows.length > 0 && tgtGrp.rows.length > 0) {
    const srcName = (srcGrp.rows[0] as any).name || '';
    const tgtName = (tgtGrp.rows[0] as any).name || '';
    const course = await sql('SELECT title_ar FROM courses WHERE id=?', (srcGrp.rows[0] as any).course_id);
    const courseName = course.rows.length > 0 ? (course.rows[0] as any).title_ar : '';
    await sendNotification(userId, 'moved_to_group', {
      courseTitle: courseName,
      oldGroupName: srcName,
      newGroupName: tgtName,
    }).catch(e => console.error('[Notify] moved_to_group failed:', e.message));
  }
}

// ──────────────────────────────────────────────
// My groups (student)
// ──────────────────────────────────────────────

export async function getMyGroups(userId: number): Promise<any[]> {
  const result = await sql(
    `SELECT g.*, c.id as course_id, c.title_ar, c.title_en, c.image_url,
            p.name as place_name, p.capacity as place_capacity
     FROM group_students gs
     JOIN groups g ON gs.group_id=g.id
     JOIN courses c ON g.course_id=c.id
     LEFT JOIN places p ON g.place_id=p.id
     WHERE gs.user_id=?
     ORDER BY g.created_at DESC`,
    userId,
  );
  return Promise.all(result.rows.map(enrich));
}

export async function getMyGroupLectures(userId: number, groupId: number): Promise<any[]> {
  const member = await sql(
    'SELECT 1 FROM group_students WHERE group_id=? AND user_id=?',
    groupId, userId,
  );
  if (member.rows.length === 0) throw { status: 403, message: 'غير مصرح لك بالوصول إلى هذه المجموعة' };

  const result = await sql(
    `SELECT l.*, COALESCE(la.attended,0) as attended, la.attended_at as attended_at_time,
            la.verification_method as attendance_method
     FROM lectures l
     LEFT JOIN lecture_attendance la ON la.lecture_id=l.id AND la.user_id=?
     WHERE l.group_id=? ORDER BY l.sort_order ASC, l.id ASC`,
    userId, groupId,
  );
  return result.rows.map((r: any) => ({
    ...r,
    day_of_week_name: getDayNameFromDate(r.date),
    attended: Boolean(Number(r.attended)),
  }));
}

export async function getMyLatestGroup(userId: number): Promise<any | null> {
  const all = await getMyGroups(userId);
  return all.length > 0 ? all[0] : null;
}

// ──────────────────────────────────────────────
// Auto-assign
// ──────────────────────────────────────────────

export async function autoAssignStudent(studentId: number, courseId: number): Promise<{ assigned: boolean; groupId?: number }> {
  // Already assigned?
  const existing = await sql(
    `SELECT 1 FROM group_students gs
     JOIN groups g ON gs.group_id=g.id
     WHERE g.course_id=? AND gs.user_id=? LIMIT 1`,
    courseId, studentId,
  );
  if (existing.rows.length > 0) return { assigned: false };

  // Get max_students threshold
  const thresholdResult = await sql("SELECT value FROM system_settings WHERE key='autoGroupThreshold'");
  let maxStudents = 30;
  if (thresholdResult.rows.length > 0) {
    const parsed = JSON.parse(thresholdResult.rows[0].value as string);
    maxStudents = parsed.threshold || 30;
  }
  const course = await sql('SELECT max_students FROM courses WHERE id=?', courseId);
  if (course.rows.length > 0) {
    maxStudents = Math.min(maxStudents, Number(course.rows[0].max_students));
  }

  // Find an available group (active, has capacity, no lecture completed yet).
  // The effective capacity is the room capacity when the group is linked to a
  // place (never above it), otherwise the group's own max_students.
  const avail = await sql(
    `SELECT g.id FROM groups g
     LEFT JOIN places p ON g.place_id=p.id
     WHERE g.course_id=? AND g.is_active=1 AND g.status IN ('pending','active')
     AND (SELECT COUNT(*) FROM group_students WHERE group_id=g.id) <
         CASE WHEN p.capacity IS NOT NULL
              THEN MIN(COALESCE(g.max_students, p.capacity), p.capacity)
              ELSE COALESCE(g.max_students, ?) END
     AND (SELECT COUNT(*) FROM lectures WHERE group_id=g.id AND is_completed=1) = 0
     ORDER BY (SELECT COUNT(*) FROM group_students WHERE group_id=g.id) ASC
     LIMIT 1`,
    courseId, maxStudents,
  );

  let groupId: number;
  if (avail.rows.length > 0) {
    groupId = Number(avail.rows[0].id);
  } else {
    // Create new group via createGroup to respect prevent_overlap
    const groupCount = await sql(
      "SELECT COUNT(*) as cnt FROM groups WHERE course_id=? AND name LIKE 'مجموعة%'",
      courseId,
    );
    const nextNum = Number(groupCount.rows[0].cnt) + 1;
    groupId = await createGroup({
      course_id: courseId,
      name: `مجموعة ${nextNum}`,
      max_students: maxStudents,
      status: 'pending',
    });
  }

  await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', groupId, studentId);
  await addHistory(studentId, groupId, 'auto_assigned');

  // Notify student
  const grp = await sql('SELECT name, course_id, instructor_name, location, start_date, end_date FROM groups WHERE id=?', groupId);
  const groupName = grp.rows.length > 0 ? (grp.rows[0] as any).name : '';
  const crs = await sql('SELECT title_ar FROM courses WHERE id=?', courseId);
  const courseName = crs.rows.length > 0 ? (crs.rows[0] as any).title_ar : '';
  await createNotification(studentId, 'تم تسكينك في مجموعة', `تم إضافتك إلى مجموعة "${groupName}" في كورس "${courseName}"`, 'success', '/dashboard');

  // External notification (email + telegram)
  if (grp.rows.length > 0) {
    const g = grp.rows[0] as any;
    await sendNotification(studentId, 'assigned_to_group', {
      groupId,
      courseTitle: courseName,
      groupName: g.name || '',
      instructor: g.instructor_name || undefined,
      location: g.location || undefined,
      startDate: g.start_date || undefined,
      endDate: g.end_date || undefined,
    }).catch(e => console.error('[Notify] assigned_to_group (auto) failed:', e.message));
  }

  return { assigned: true, groupId };
}

// ──────────────────────────────────────────────
// Unassigned students
// ──────────────────────────────────────────────

export async function getUnassignedCount(): Promise<number> {
  const result = await sql(
    `SELECT COUNT(*) as cnt FROM order_items oi
     JOIN orders o ON oi.order_id=o.id
     JOIN courses c ON oi.course_id=c.id
     WHERE o.status='paid'
     AND o.user_id NOT IN (
       SELECT gs.user_id FROM group_students gs
       JOIN groups g ON gs.group_id=g.id WHERE g.course_id=oi.course_id
     )`,
  );
  return Number(result.rows[0].cnt);
}

export async function getUnassignedStudents(): Promise<any[]> {
  const result = await sql(
    `SELECT o.id as order_id, u.id as user_id, u.name, u.email, u.phone,
            c.id as course_id, c.title_ar as course_name, c.auto_assign
     FROM order_items oi
     JOIN orders o ON oi.order_id=o.id
     JOIN users u ON o.user_id=u.id
     JOIN courses c ON oi.course_id=c.id
     WHERE o.status='paid'
     AND o.user_id NOT IN (
       SELECT gs.user_id FROM group_students gs
       JOIN groups g ON gs.group_id=g.id WHERE g.course_id=oi.course_id
     )
     ORDER BY o.created_at DESC`,
  );
  return result.rows.map(formatRow);
}

export async function getUnassignedByCourse(courseId: number): Promise<any[]> {
  const result = await sql(
    `SELECT o.id as order_id, u.id as user_id, u.name, u.email, u.phone
     FROM order_items oi
     JOIN orders o ON oi.order_id=o.id
     JOIN users u ON o.user_id=u.id
     WHERE oi.course_id=? AND o.status='paid'
     AND o.user_id NOT IN (
       SELECT gs.user_id FROM group_students gs
       JOIN groups g ON gs.group_id=g.id WHERE g.course_id=?
     )`,
    courseId, courseId,
  );
  return result.rows.map(formatRow);
}

export async function batchAssignStudents(userIds: number[], groupId: number, movedBy?: number): Promise<number> {
  await assertGroupOpen(groupId, 'تسكين الطلاب');
  const hasStarted = await groupHasStarted(groupId);
  if (hasStarted) throw { status: 400, message: 'لا يمكن التسكين في مجموعة بدأت بالفعل' };

  const capacity = await getGroupCapacity(groupId);
  if (capacity.students >= (capacity.max ?? Infinity)) {
    const where = capacity.place ? ` في المكان "${capacity.place.name}"` : '';
    throw {
      status: 400,
      message: `المجموعة "${capacity.groupName}" ممتلئة (السعة ${capacity.max}${where}) — لا يمكن إضافة طلاب جدد`,
    };
  }

  // Get course_id for duplicate check
  const grpInfo = await sql('SELECT course_id FROM groups WHERE id=?', groupId);
  const courseGroupId = grpInfo.rows.length > 0 ? Number((grpInfo.rows[0] as any).course_id) : null;

  let assigned = 0;
  for (const userId of userIds) {
    try {
      const exists = await sql('SELECT 1 FROM group_students WHERE group_id=? AND user_id=?', groupId, userId);
      if (exists.rows.length === 0) {
        // Check if student is already in another group for the same course
        if (courseGroupId) {
          const dupCheck = await isStudentInCourseGroup(userId, courseGroupId, groupId);
          if (dupCheck.inGroup) {
            console.log(`Skipping user ${userId}: already in group "${dupCheck.groupName}" for course ${courseGroupId}`);
            continue;
          }
        }
        if (capacity.max != null && capacity.students + assigned >= capacity.max) {
          const where = capacity.place ? ` في المكان "${capacity.place.name}"` : '';
          throw {
            status: 400,
            message: `تم تسكين ${assigned} طالب ثم امتلأت سعة المجموعة (${capacity.max}${where}). لم يُسكن بقية الطلاب`,
          };
        }
        await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', groupId, userId);
        await addHistory(userId, groupId, 'batch_assigned', movedBy);
        assigned++;
      }
    } catch (err: any) {
      if (err?.status === 400) throw err;
      /* skip duplicate */
    }
  }
  return assigned;
}

export async function assignStudentToGroup(userId: number, groupId: number, movedBy?: number): Promise<void> {
  await assertGroupOpen(groupId, 'تسكين الطالب');
  const hasStarted = await groupHasStarted(groupId);
  if (hasStarted) throw { status: 400, message: 'لا يمكن التسكين في مجموعة بدأت بالفعل' };

  // Check if student is already in another group for the same course
  const grpInfo = await sql('SELECT course_id FROM groups WHERE id=?', groupId);
  if (grpInfo.rows.length > 0) {
    const courseGroupId = Number((grpInfo.rows[0] as any).course_id);
    const dupCheck = await isStudentInCourseGroup(userId, courseGroupId, groupId);
    if (dupCheck.inGroup) {
      throw { status: 400, message: `الطالب مسجل بالفعل في مجموعة "${dupCheck.groupName}" لهذا الكورس` };
    }
  }

  const exists = await sql(
    'SELECT 1 FROM group_students WHERE group_id=? AND user_id=?',
    groupId, userId,
  );
  if (exists.rows.length > 0) throw { status: 400, message: 'Student already in this group' };
  await assertCapacity(groupId, 1);
  await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', groupId, userId);
  await addHistory(userId, groupId, 'assigned', movedBy);
}

// ──────────────────────────────────────────────
// Incomplete groups (for dashboard)
// ──────────────────────────────────────────────

export async function getIncompleteGroups(): Promise<any[]> {
  const result = await sql(
    `SELECT g.id, g.name, g.is_complete, g.course_id,
            c.title_ar as course_name
     FROM groups g JOIN courses c ON g.course_id=c.id
     WHERE g.is_complete=0 AND g.is_active=1
     ORDER BY g.created_at DESC`,
  );
  return result.rows.map(formatRow);
}

// ──────────────────────────────────────────────
// Lectures
// ──────────────────────────────────────────────

export async function getGroupLectures(groupId: number): Promise<any[]> {
  const result = await sql(
    'SELECT * FROM lectures WHERE group_id=? ORDER BY sort_order ASC, id ASC',
    groupId,
  );
  return result.rows.map((r: any) => ({
    ...r,
    day_of_week_name: getDayNameFromDate(r.date),
  }));
}

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function addLecture(groupId: number, data: {
  date?: string;
  time_from?: string;
  time_to?: string;
  topic?: string;
  location?: string;
  zoom_link?: string;
}): Promise<number> {
  if (!data.date) throw { status: 400, message: 'Lecture date required' };
  await assertGroupOpen(groupId, 'إضافة محاضرة');

  // Enforce date ordering — new lecture must be >= last lecture's date
  const lastDate = await sql(
    'SELECT MAX(date) as max_date FROM lectures WHERE group_id=? AND date IS NOT NULL',
    groupId,
  );
  const maxDate = lastDate.rows.length > 0 ? (lastDate.rows[0] as any).max_date : null;
  if (maxDate && data.date < maxDate) {
    throw { status: 400, message: 'تاريخ المحاضرة الجديدة يجب أن لا يسبق تاريخ آخر محاضرة' };
  }

  const maxSort = await sql('SELECT COALESCE(MAX(sort_order),0) as m FROM lectures WHERE group_id=?', groupId);
  const nextSort = Number(maxSort.rows[0].m) + 1;
  const result = await sql(
    `INSERT INTO lectures (group_id, date, time_from, time_to, topic, location, zoom_link, sort_order)
     VALUES (?,?,?,?,?,?,?,?)`,
    groupId, data.date || null, data.time_from || '', data.time_to || '',
    data.topic || '', data.location || '', data.zoom_link || null, nextSort,
  );
  await recalcStatus(groupId);

  // External notification to all group students (email + telegram)
  const grp = await sql('SELECT name, course_id FROM groups WHERE id=?', groupId);
  if (grp.rows.length > 0) {
    const g = grp.rows[0] as any;
    const course = await sql('SELECT title_ar FROM courses WHERE id=?', g.course_id);
    const courseName = course.rows.length > 0 ? (course.rows[0] as any).title_ar : '';
    await notifyGroupStudentsExt(groupId, 'lecture_added', {
      groupId,
      courseTitle: courseName,
      groupName: g.name || '',
      topic: data.topic || '',
      date: data.date || '',
      timeFrom: data.time_from || undefined,
      timeTo: data.time_to || undefined,
      location: data.location || undefined,
      zoomLink: data.zoom_link || undefined,
    }).catch(e => console.error('[Notify] lecture_added failed:', e.message));
  }

  return Number(result.lastInsertRowid);
}

export async function updateLecture(groupId: number, lectureId: number, data: {
  date?: string;
  time_from?: string;
  time_to?: string;
  topic?: string;
  location?: string;
  zoom_link?: string;
  is_completed?: number;
}): Promise<void> {
  const today = todayDateString();

  // Fetch current lecture to check ordering & completion rules
  const current = await sql('SELECT date, sort_order FROM lectures WHERE id=?', lectureId);
  if (current.rows.length === 0) throw { status: 404, message: 'Lecture not found' };

  const newDate = data.date !== undefined ? data.date : (current.rows[0] as any).date;

  // Prevent completing a lecture before its date
  if (data.is_completed !== undefined && data.is_completed) {
    if (newDate && newDate > today) {
      throw { status: 400, message: 'لا يمكن إكمال محاضرة قبل تاريخها' };
    }
  }

  // Enforce date ordering on update
  if (data.date !== undefined) {
    // Check previous lecture (sort_order < current, max sort_order)
    const prev = await sql(
      `SELECT date FROM lectures WHERE group_id=? AND sort_order < ? AND id!=?
       ORDER BY sort_order DESC LIMIT 1`,
      groupId, (current.rows[0] as any).sort_order, lectureId,
    );
    if (prev.rows.length > 0 && (prev.rows[0] as any).date && data.date < (prev.rows[0] as any).date) {
      throw { status: 400, message: 'تاريخ المحاضرة يجب أن لا يسبق تاريخ المحاضرة التي قبلها' };
    }

    // Check next lecture (sort_order > current, min sort_order)
    const next = await sql(
      `SELECT date FROM lectures WHERE group_id=? AND sort_order > ? AND id!=?
       ORDER BY sort_order ASC LIMIT 1`,
      groupId, (current.rows[0] as any).sort_order, lectureId,
    );
    if (next.rows.length > 0 && (next.rows[0] as any).date && data.date > (next.rows[0] as any).date) {
      throw { status: 400, message: 'تاريخ المحاضرة يجب أن لا يتجاوز تاريخ المحاضرة التي بعدها' };
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  const fields: (keyof typeof data)[] = ['date', 'time_from', 'time_to', 'topic', 'location', 'zoom_link'];
  for (const f of fields) {
    if (data[f] !== undefined) { sets.push(`${f}=?`); params.push(data[f]); }
  }
  if (data.is_completed !== undefined) {
    sets.push('is_completed=?'); params.push(data.is_completed ? 1 : 0);
    sets.push('completed_at=?'); params.push(data.is_completed ? new Date().toISOString() : null);
  }
  if (sets.length === 0) return;
  params.push(lectureId);
  await sql(`UPDATE lectures SET ${sets.join(', ')} WHERE id=?`, ...params);
  await recalcStatus(groupId);
}

export async function toggleLectureComplete(groupId: number, lectureId: number): Promise<number> {
  const lec = await sql('SELECT is_completed, date FROM lectures WHERE id=?', lectureId);
  if (lec.rows.length === 0) throw { status: 404, message: 'Lecture not found' };
  const current = Number(lec.rows[0].is_completed);
  const newVal = current ? 0 : 1;

  if (newVal) {
    const today = todayDateString();
    const lecDate = (lec.rows[0] as any).date;
    if (lecDate && lecDate > today) {
      throw { status: 400, message: 'لا يمكن إكمال محاضرة قبل تاريخها' };
    }
  }

  await sql(
    'UPDATE lectures SET is_completed=?, completed_at=? WHERE id=?',
    newVal, newVal ? new Date().toISOString() : null, lectureId,
  );
  await recalcStatus(groupId);

  // External notification when lecture is completed (email + telegram)
  if (newVal) {
    const lec = await sql('SELECT topic FROM lectures WHERE id=?', lectureId);
    const grp = await sql('SELECT name, course_id FROM groups WHERE id=?', groupId);
    if (lec.rows.length > 0 && grp.rows.length > 0) {
      const g = grp.rows[0] as any;
      const course = await sql('SELECT title_ar FROM courses WHERE id=?', g.course_id);
      const courseName = course.rows.length > 0 ? (course.rows[0] as any).title_ar : '';
      await notifyGroupStudentsExt(groupId, 'lecture_completed', {
        courseTitle: courseName,
        groupName: g.name || '',
        topic: (lec.rows[0] as any).topic || '',
      }).catch(e => console.error('[Notify] lecture_completed failed:', e.message));
    }
  }

  return newVal;
}

export async function deleteLecture(groupId: number, lectureId: number): Promise<void> {
  await sql('DELETE FROM lectures WHERE id=?', lectureId);
  await recalcStatus(groupId);
}

// ──────────────────────────────────────────────
// Attendance
// ──────────────────────────────────────────────

export async function getLectureAttendance(lectureId: number): Promise<any[]> {
  const result = await sql(
    `SELECT la.*, u.name, u.email
     FROM lecture_attendance la
     JOIN users u ON la.user_id=u.id
     WHERE la.lecture_id=?`,
    lectureId,
  );
  return result.rows.map(formatRow);
}

export async function getGroupAttendanceForLecture(groupId: number, lectureId: number): Promise<any[]> {
  // All students in group + their attendance for this lecture
  const result = await sql(
    `SELECT u.id as user_id, u.name, u.email,
            COALESCE(la.attended, 0) as attended, la.attended_at
     FROM group_students gs
     JOIN users u ON gs.user_id=u.id
     LEFT JOIN lecture_attendance la ON la.user_id=u.id AND la.lecture_id=?
     WHERE gs.group_id=?
     ORDER BY u.name`,
    lectureId, groupId,
  );
  return result.rows.map(formatRow);
}

export async function setAttendance(lectureId: number, userId: number, attended: boolean): Promise<void> {
  await sql(
    `INSERT INTO lecture_attendance (lecture_id, user_id, attended, attended_at)
     VALUES (?,?,?,?)
     ON CONFLICT(lecture_id, user_id) DO UPDATE SET attended=?, attended_at=?`,
    lectureId, userId, attended ? 1 : 0, attended ? new Date().toISOString() : null,
    attended ? 1 : 0, attended ? new Date().toISOString() : null,
  );
}

export async function bulkSetAttendance(lectureId: number, records: { user_id: number; attended: boolean }[]): Promise<void> {
  for (const r of records) {
    await setAttendance(lectureId, r.user_id, r.attended);
  }
}

export async function getLectureById(lectureId: number): Promise<any | null> {
  const result = await sql(
    `SELECT l.*, g.course_id FROM lectures l JOIN groups g ON l.group_id=g.id WHERE l.id=?`,
    lectureId,
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}
