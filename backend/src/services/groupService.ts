import { sql } from '../db/helpers';
import { createNotification } from './notificationService';

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

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
// Rule helpers
// ──────────────────────────────────────────────

async function groupHasStarted(groupId: number): Promise<boolean> {
  const result = await sql('SELECT COUNT(*) as cnt FROM lectures WHERE group_id=?', groupId);
  return Number(result.rows[0].cnt) > 0;
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
  // Read old state before update
  const old = await sql('SELECT is_complete, course_id FROM groups WHERE id=?', groupId);
  const wasComplete = old.rows.length > 0 ? Number((old.rows[0] as any).is_complete) : 0;
  const courseId = old.rows.length > 0 ? Number((old.rows[0] as any).course_id) : null;

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

  // Auto-create next group when transitioning to completed and prevent_overlap is ON
  if (isComplete && !wasComplete && courseId) {
    const course = await sql('SELECT prevent_overlap, instructor, max_students FROM courses WHERE id=?', courseId);
    if (course.rows.length > 0 && Number((course.rows[0] as any).prevent_overlap)) {
      // Deactivate the completed group
      await sql('UPDATE groups SET is_active=0 WHERE id=?', groupId);

      // Create a new pending group
      const groupCount = await sql(
        "SELECT COUNT(*) as cnt FROM groups WHERE course_id=? AND name LIKE 'مجموعة%'",
        courseId,
      );
      const nextNum = Number(groupCount.rows[0].cnt) + 1;
      const instructor = (course.rows[0] as any).instructor || '';
      const maxStudents = (course.rows[0] as any).max_students || null;

      await sql(
        `INSERT INTO groups (course_id, name, instructor_name, max_students, status, is_active)
         VALUES (?,?,?,?,'pending',1)`,
        courseId, `مجموعة ${nextNum}`, instructor, maxStudents,
      );
    }
  }

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
  group.has_started = all.length > 0;
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

  // Prevent duplicate pending groups for the same course
  const hasPending = await checkPendingExists(course_id);
  if (hasPending) throw { status: 400, message: 'يوجد مجموعة قيد الانتظار بالفعل لهذا الكورس' };

  const groupStatus = ['active', 'completed', 'cancelled'].includes(status || '') ? status : 'pending';
  const hasOverlap = await checkPreventOverlap(course_id);
  const isActive = hasOverlap ? 0 : 1;

  const result = await sql(
    `INSERT INTO groups (course_id, name, zoom_link, end_date, instructor_name, location, max_students, status, is_active)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    course_id, name, zoom_link || null, end_date || null,
    instructor, location || null, max_students || null, groupStatus, isActive,
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
  // Prevent activating if another active group exists in the same course
  if (data.is_active !== undefined && Number(data.is_active)) {
    const grp = await sql('SELECT course_id FROM groups WHERE id=?', id);
    if (grp.rows.length > 0) {
      const courseId = Number(grp.rows[0].course_id);
      const hasOverlap = await checkPreventOverlap(courseId, id);
      if (hasOverlap) {
        throw { status: 400, message: 'يوجد مجموعة نشطة بالفعل لهذا الكورس، قم بتعطيلها أولاً' };
      }
    }
  }

  // Prevent setting to pending if another pending group exists
  if (data.status === 'pending') {
    const grp = await sql('SELECT course_id FROM groups WHERE id=?', id);
    if (grp.rows.length > 0) {
      const courseId = Number(grp.rows[0].course_id);
      const hasPending = await checkPendingExists(courseId, id);
      if (hasPending) {
        throw { status: 400, message: 'يوجد مجموعة قيد الانتظار بالفعل لهذا الكورس' };
      }
    }
  }

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

export async function batchToggleGroups(ids: number[], isActive: boolean): Promise<number> {
  let updated = 0;
  const val = isActive ? 1 : 0;
  for (const id of ids) {
    try {
      // Only check overlap when activating
      if (val) {
        const grp = await sql('SELECT course_id FROM groups WHERE id=?', id);
        if (grp.rows.length > 0) {
          const courseId = Number(grp.rows[0].course_id);
          const hasOverlap = await checkPreventOverlap(courseId, id);
          if (hasOverlap) continue; // skip — another active group exists
        }
      }
      await sql('UPDATE groups SET is_active=? WHERE id=?', val, id);
      updated++;
    } catch { /* skip */ }
  }
  return updated;
}

export async function batchUpdateGroupStatus(ids: number[], status: string): Promise<number> {
  if (!['active', 'completed', 'cancelled', 'pending'].includes(status)) {
    throw { status: 400, message: `Invalid status: ${status}` };
  }
  let updated = 0;
  for (const id of ids) {
    try {
      // Skip if this would create duplicate pending
      if (status === 'pending') {
        const grp = await sql('SELECT course_id FROM groups WHERE id=?', id);
        if (grp.rows.length > 0) {
          const hasPending = await checkPendingExists(Number(grp.rows[0].course_id), id);
          if (hasPending) continue;
        }
      }
      await sql('UPDATE groups SET status=? WHERE id=?', status, id);
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
  const hasStarted = await groupHasStarted(groupId);
  if (hasStarted) throw { status: 400, message: 'لا يمكن التسكين في مجموعة بدأت بالفعل — تمتلك محاضرات مسجلة' };

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
}

// ──────────────────────────────────────────────
// My groups (student)
// ──────────────────────────────────────────────

export async function getMyGroups(userId: number): Promise<any[]> {
  const result = await sql(
    `SELECT g.*, c.id as course_id, c.title_ar, c.title_en, c.image_url
     FROM group_students gs
     JOIN groups g ON gs.group_id=g.id
     JOIN courses c ON g.course_id=c.id
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

export async function batchAssignStudents(userIds: number[], groupId: number, movedBy?: number): Promise<number> {
  const hasStarted = await groupHasStarted(groupId);
  if (hasStarted) throw { status: 400, message: 'لا يمكن التسكين في مجموعة بدأت بالفعل' };

  let assigned = 0;
  for (const userId of userIds) {
    try {
      const exists = await sql('SELECT 1 FROM group_students WHERE group_id=? AND user_id=?', groupId, userId);
      if (exists.rows.length === 0) {
        await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', groupId, userId);
        await addHistory(userId, groupId, 'batch_assigned', movedBy);
        assigned++;
      }
    } catch { /* skip duplicate */ }
  }
  return assigned;
}

export async function assignStudentToGroup(userId: number, groupId: number, movedBy?: number): Promise<void> {
  const hasStarted = await groupHasStarted(groupId);
  if (hasStarted) throw { status: 400, message: 'لا يمكن التسكين في مجموعة بدأت بالفعل' };

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
