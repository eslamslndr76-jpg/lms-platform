import { sql } from '../db/helpers';
import { createNotification } from './notificationService';

const DAY_NAMES_AR = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

function formatRow(r: any): any {
  const out = { ...r };
  for (const k of ['id', 'course_id', 'is_active', 'is_complete', 'max_students', 'sort_order']) {
    if (out[k] !== undefined) out[k] = Number(out[k]);
  }
  return out;
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
// Status helpers
// ──────────────────────────────────────────────
async function recalcStatus(groupId: number): Promise<void> {
  const lec = await sql(
    'SELECT COUNT(*) as total, SUM(is_completed) as done FROM lectures WHERE group_id=?',
    groupId,
  );
  const total = Number(lec.rows[0].total);
  const done = Number(lec.rows[0].done || 0);
  const isComplete = total > 0 && done === total ? 1 : 0;
  const status = total === 0 ? 'pending' : isComplete ? 'completed' : 'active';
  await sql(
    'UPDATE groups SET is_complete=?, status=? WHERE id=?',
    isComplete, status, groupId,
  );
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
  let query = `SELECT g.*, c.title_ar as course_name FROM groups g JOIN courses c ON g.course_id=c.id`;
  const params: unknown[] = [];
  if (courseId) { query += ' WHERE g.course_id=?'; params.push(courseId); }
  query += ' ORDER BY g.created_at DESC';
  const result = await sql(query, ...params);
  return Promise.all(result.rows.map(enrich));
}

export async function getGroupById(id: number): Promise<any | null> {
  const result = await sql(
    'SELECT g.*, c.title_ar as course_name FROM groups g JOIN courses c ON g.course_id=c.id WHERE g.id=?',
    id,
  );
  if (result.rows.length === 0) return null;
  return enrich(result.rows[0] as any);
}

export async function createGroup(data: {
  course_id: number;
  name: string;
  zoom_link?: string;
  end_date?: string;
  instructor_name?: string;
  location?: string;
  max_students?: number | null;
  status?: string;
}): Promise<number> {
  const {
    course_id, name, zoom_link, end_date, instructor_name, location, max_students, status,
  } = data;
  if (!name) throw { status: 400, message: 'Group name required' };

  // Auto-fill instructor from course if not provided
  let instructor = instructor_name || '';
  if (!instructor) {
    const course = await sql('SELECT instructor FROM courses WHERE id=?', course_id);
    if (course.rows.length > 0) instructor = (course.rows[0] as any).instructor || '';
  }

  const groupStatus = ['active', 'completed', 'cancelled'].includes(status || '') ? status : 'pending';

  const result = await sql(
    `INSERT INTO groups (course_id, name, zoom_link, end_date, instructor_name, location, max_students, status)
     VALUES (?,?,?,?,?,?,?,?)`,
    course_id, name, zoom_link || null, end_date || null,
    instructor, location || null, max_students || null, groupStatus,
  );
  return Number(result.lastInsertRowid);
}

export async function updateGroup(id: number, data: {
  name?: string;
  zoom_link?: string;
  end_date?: string;
  instructor_name?: string;
  location?: string;
  max_students?: number | null;
  is_active?: number;
  status?: string;
}): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  const fields: (keyof typeof data)[] = ['name', 'zoom_link', 'end_date', 'instructor_name', 'location', 'max_students', 'is_active', 'status'];
  for (const f of fields) {
    if (data[f] !== undefined) { sets.push(`${f}=?`); params.push(data[f]); }
  }
  if (sets.length === 0) return;
  params.push(id);
  await sql(`UPDATE groups SET ${sets.join(', ')} WHERE id=?`, ...params);
  await recalcStatus(id);
}

export async function deleteGroup(id: number): Promise<void> {
  await sql('DELETE FROM group_student_history WHERE group_id=?', id);
  await sql('DELETE FROM lecture_attendance WHERE lecture_id IN (SELECT id FROM lectures WHERE group_id=?)', id);
  await sql('DELETE FROM lectures WHERE group_id=?', id);
  await sql('DELETE FROM group_students WHERE group_id=?', id);
  await sql('DELETE FROM groups WHERE id=?', id);
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
  let added = 0;
  for (const userId of userIds) {
    const exists = await sql(
      'SELECT 1 FROM group_students WHERE group_id=? AND user_id=?',
      groupId, userId,
    );
    if (exists.rows.length === 0) {
      await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', groupId, userId);
      await addHistory(userId, groupId, 'assigned', movedBy);
      // Get group info for notification
      const grp = await sql('SELECT name, course_id FROM groups WHERE id=?', groupId);
      if (grp.rows.length > 0) {
        const g = grp.rows[0] as any;
        const course = await sql('SELECT title_ar FROM courses WHERE id=?', g.course_id);
        const courseName = course.rows.length > 0 ? (course.rows[0] as any).title_ar : '';
        await createNotification(userId, 'تم إضافتك إلى مجموعة', `تم إضافتك إلى مجموعة "${g.name}" في كورس "${courseName}"`, 'success', `/dashboard`);
      }
      added++;
    }
  }
  return added;
}

export async function removeStudentFromGroup(groupId: number, userId: number, movedBy?: number): Promise<void> {
  await sql('DELETE FROM group_students WHERE group_id=? AND user_id=?', groupId, userId);
  await addHistory(userId, groupId, 'removed', movedBy);
}

export async function moveStudent(sourceGroupId: number, userId: number, targetGroupId: number, movedBy?: number): Promise<void> {
  // Verify source group exists
  const src = await sql('SELECT course_id FROM groups WHERE id=?', sourceGroupId);
  if (src.rows.length === 0) throw { status: 404, message: 'Source group not found' };
  const srcCourseId = Number((src.rows[0] as any).course_id);

  // Verify target group exists, same course, and has capacity
  const tgt = await sql('SELECT course_id, max_students FROM groups WHERE id=? AND is_active=1', targetGroupId);
  if (tgt.rows.length === 0) throw { status: 404, message: 'Target group not found or inactive' };
  const tgtCourseId = Number((tgt.rows[0] as any).course_id);
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
}

// ──────────────────────────────────────────────
// My groups (student)
// ──────────────────────────────────────────────

export async function getMyGroups(userId: number): Promise<any[]> {
  const result = await sql(
    `SELECT g.*, c.id as course_id, c.title_ar, c.title_en
     FROM group_students gs
     JOIN groups g ON gs.group_id=g.id
     JOIN courses c ON g.course_id=c.id
     WHERE gs.user_id=? AND g.is_active=1
     ORDER BY g.created_at DESC`,
    userId,
  );
  return Promise.all(result.rows.map(enrich));
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

  // Find an available group (active, has capacity, no lecture started yet)
  const avail = await sql(
    `SELECT g.id FROM groups g
     WHERE g.course_id=? AND g.is_active=1 AND g.status IN ('pending','active')
     AND (SELECT COUNT(*) FROM group_students WHERE group_id=g.id) < COALESCE(g.max_students, ?)
     AND (
       (SELECT MIN(date) FROM lectures WHERE group_id=g.id AND date IS NOT NULL) IS NULL
       OR
       (SELECT MIN(date) FROM lectures WHERE group_id=g.id AND date IS NOT NULL) >= date('now')
     )
     ORDER BY (SELECT COUNT(*) FROM group_students WHERE group_id=g.id) ASC
     LIMIT 1`,
    courseId, maxStudents,
  );

  let groupId: number;
  if (avail.rows.length > 0) {
    groupId = Number(avail.rows[0].id);
  } else {
    // Create new group
    const groupCount = await sql(
      "SELECT COUNT(*) as cnt FROM groups WHERE course_id=? AND name LIKE 'مجموعة%'",
      courseId,
    );
    const nextNum = Number(groupCount.rows[0].cnt) + 1;
    const ins = await sql(
      `INSERT INTO groups (course_id, name, max_students, status) VALUES (?,?,?,'pending')`,
      courseId, `مجموعة ${nextNum}`, maxStudents,
    );
    groupId = Number(ins.lastInsertRowid);
  }

  await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', groupId, studentId);
  await addHistory(studentId, groupId, 'auto_assigned');

  // Notify student
  const grp = await sql('SELECT name FROM groups WHERE id=?', groupId);
  const groupName = grp.rows.length > 0 ? (grp.rows[0] as any).name : '';
  const crs = await sql('SELECT title_ar FROM courses WHERE id=?', courseId);
  const courseName = crs.rows.length > 0 ? (crs.rows[0] as any).title_ar : '';
  await createNotification(studentId, 'تم تسكينك في مجموعة', `تم إضافتك إلى مجموعة "${groupName}" في كورس "${courseName}"`, 'success', '/dashboard');

  return { assigned: true, groupId };
}

// ──────────────────────────────────────────────
// Unassigned students
// ──────────────────────────────────────────────

export async function getUnassignedCount(): Promise<number> {
  const result = await sql(
    `SELECT COUNT(*) as cnt FROM orders o
     JOIN courses c ON o.course_id=c.id
     WHERE o.status='paid'
     AND o.user_id NOT IN (
       SELECT gs.user_id FROM group_students gs
       JOIN groups g ON gs.group_id=g.id WHERE g.course_id=o.course_id
     )`,
  );
  return Number(result.rows[0].cnt);
}

export async function getUnassignedStudents(): Promise<any[]> {
  const result = await sql(
    `SELECT o.id as order_id, u.id as user_id, u.name, u.email, u.phone,
            c.id as course_id, c.title_ar as course_name, c.auto_assign
     FROM orders o
     JOIN users u ON o.user_id=u.id
     JOIN courses c ON o.course_id=c.id
     WHERE o.status='paid'
     AND o.user_id NOT IN (
       SELECT gs.user_id FROM group_students gs
       JOIN groups g ON gs.group_id=g.id WHERE g.course_id=o.course_id
     )
     ORDER BY o.created_at DESC`,
  );
  return result.rows.map(formatRow);
}

export async function getUnassignedByCourse(courseId: number): Promise<any[]> {
  const result = await sql(
    `SELECT o.id as order_id, u.id as user_id, u.name, u.email, u.phone
     FROM orders o
     JOIN users u ON o.user_id=u.id
     WHERE o.course_id=? AND o.status='paid'
     AND o.user_id NOT IN (
       SELECT gs.user_id FROM group_students gs
       JOIN groups g ON gs.group_id=g.id WHERE g.course_id=?
     )`,
    courseId, courseId,
  );
  return result.rows.map(formatRow);
}

export async function assignStudentToGroup(userId: number, groupId: number, movedBy?: number): Promise<void> {
  const exists = await sql(
    'SELECT 1 FROM group_students WHERE group_id=? AND user_id=?',
    groupId, userId,
  );
  if (exists.rows.length > 0) throw { status: 400, message: 'Student already in this group' };
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

export async function addLecture(groupId: number, data: {
  date?: string;
  time_from?: string;
  time_to?: string;
  topic?: string;
  zoom_link?: string;
}): Promise<number> {
  if (!data.date) throw { status: 400, message: 'Lecture date required' };
  const maxSort = await sql('SELECT COALESCE(MAX(sort_order),0) as m FROM lectures WHERE group_id=?', groupId);
  const nextSort = Number(maxSort.rows[0].m) + 1;
  const result = await sql(
    `INSERT INTO lectures (group_id, date, time_from, time_to, topic, zoom_link, sort_order)
     VALUES (?,?,?,?,?,?,?)`,
    groupId, data.date || null, data.time_from || '', data.time_to || '',
    data.topic || '', data.zoom_link || null, nextSort,
  );
  await recalcStatus(groupId);
  return Number(result.lastInsertRowid);
}

export async function updateLecture(groupId: number, lectureId: number, data: {
  date?: string;
  time_from?: string;
  time_to?: string;
  topic?: string;
  zoom_link?: string;
  is_completed?: number;
}): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  const fields: (keyof typeof data)[] = ['date', 'time_from', 'time_to', 'topic', 'zoom_link'];
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
  const lec = await sql('SELECT is_completed FROM lectures WHERE id=?', lectureId);
  if (lec.rows.length === 0) throw { status: 404, message: 'Lecture not found' };
  const current = Number(lec.rows[0].is_completed);
  const newVal = current ? 0 : 1;
  await sql(
    'UPDATE lectures SET is_completed=?, completed_at=? WHERE id=?',
    newVal, newVal ? new Date().toISOString() : null, lectureId,
  );
  await recalcStatus(groupId);
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
