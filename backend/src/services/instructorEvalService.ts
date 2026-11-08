import { sql } from '../db/helpers';
import { createNotification } from './notificationService';
import { sendNotification } from './externalNotificationService';

/**
 * Instructor evaluation of the group's students (edit-plan.md §5).
 *
 * Behaviour-only record: it never affects certificates, grades or any other
 * system. One evaluation per group, saved as a draft then submitted once; only
 * an admin can reopen a submitted evaluation.
 */

export const EVAL_QUESTIONS = [
  { key: 'commitment', label: 'يلتزم المتدرب بقواعد النظام داخل وخارج القاعة التدريبية' },
  {
    key: 'attendance',
    label: 'يحرص على التواجد داخل القاعة التدريبية أو الجلسة الافتراضية طوال فترة التدريب',
  },
  { key: 'conduct', label: 'يتعامل مع زملائه والمدرب والمشرفين بشكل لائق' },
  {
    key: 'participation',
    label: 'يشارك بإيجابية داخل القاعة التدريبية أو الجلسة الافتراضية',
  },
] as const;

/**
 * Offline groups sit in a real hall, online groups in a virtual session.
 * The wording follows the course mode instead of mixing both.
 */
function buildQuestions(courseMode: string): { key: string; label: string }[] {
  const online = courseMode !== 'offline';
  return [
    { key: 'commitment', label: 'يلتزم المتدرب بقواعد النظام داخل وخارج القاعة التدريبية' },
    {
      key: 'attendance',
      label: online
        ? 'يحرص على التواجد في الجلسة الافتراضية طوال فترة التدريب'
        : 'يحرص على التواجد داخل القاعة التدريبية طوال فترة التدريب',
    },
    { key: 'conduct', label: 'يتعامل مع زملائه والمدرب والمشرفين بشكل لائق' },
    {
      key: 'participation',
      label: online
        ? 'يشارك بإيجابية داخل الجلسة الافتراضية'
        : 'يشارك بإيجابية داخل قاعة التدريب',
    },
  ];
}

export const EVAL_SCALE = [
  { value: 1, label: 'ضعيف' },
  { value: 2, label: 'مقبول' },
  { value: 3, label: 'جيد' },
  { value: 4, label: 'جيد جداً' },
  { value: 5, label: 'ممتاز' },
];

const QUESTION_COUNT = EVAL_QUESTIONS.length;

interface EvalGroup {
  id: number;
  name: string;
  status: string;
  completed_at: string | null;
  eval_opened_at: string | null;
  course_id: number;
  course_title: string;
  course_mode: string;
  start_date: string | null;
  instructor_name: string;
  place_name: string;
}

async function loadGroupForInstructor(instructorId: number, groupId: number): Promise<EvalGroup> {
  const result = await sql(
    `SELECT g.id, g.name, g.status, g.completed_at, g.instructor_eval_opened_at,
            g.course_id, g.start_date, g.instructor_name, c.title_ar as course_title,
            c.course_mode, p.name as place_name
     FROM groups g JOIN courses c ON g.course_id=c.id
     LEFT JOIN places p ON g.place_id=p.id
     WHERE g.id=? AND g.instructor_user_id=?`,
    groupId, instructorId,
  );
  if (result.rows.length === 0) {
    throw { status: 403, message: 'غير مصرح لك بالوصول إلى هذه المجموعة' };
  }
  const row = result.rows[0] as any;
  return {
    id: Number(row.id),
    name: row.name || '',
    status: row.status || '',
    completed_at: row.completed_at || null,
    eval_opened_at: row.instructor_eval_opened_at || null,
    course_id: Number(row.course_id),
    course_title: row.course_title || '',
    course_mode: row.course_mode || 'online',
    start_date: row.start_date || null,
    instructor_name: row.instructor_name || '',
    place_name: row.place_name || '',
  };
}

function isGroupCompleted(group: EvalGroup): boolean {
  return group.status === 'completed' && Boolean(group.completed_at);
}

async function loadStudents(groupId: number): Promise<{ id: number; name: string; email: string }[]> {
  const result = await sql(
    `SELECT u.id, u.name, u.email
     FROM group_students gs JOIN users u ON gs.user_id=u.id
     WHERE gs.group_id=?
     ORDER BY u.name`,
    groupId,
  );
  return result.rows.map((row: any) => ({
    id: Number(row.id),
    name: row.name || '',
    email: row.email || '',
  }));
}

async function loadEvalRow(groupId: number): Promise<any | null> {
  const result = await sql(
    'SELECT id, status, submitted_at, updated_at FROM group_instructor_evals WHERE group_id=?',
    groupId,
  );
  return result.rows.length > 0 ? (result.rows[0] as any) : null;
}

async function loadScoreRows(
  evalId: number,
): Promise<Map<number, { scores: (number | null)[]; total: number }>> {
  const result = await sql(
    'SELECT student_id, scores, total FROM group_instructor_eval_scores WHERE eval_id=?',
    evalId,
  );
  const map = new Map<number, { scores: (number | null)[]; total: number }>();
  for (const row of result.rows as any[]) {
    let scores: (number | null)[] = [];
    try {
      const parsed = JSON.parse(row.scores || '[]');
      if (Array.isArray(parsed)) scores = parsed;
    } catch {
      scores = [];
    }
    map.set(Number(row.student_id), {
      scores: normalizeScores(scores),
      total: Number(row.total || 0),
    });
  }
  return map;
}

/** Keep exactly four entries, each an integer 1–5 or null. */
function normalizeScores(raw: unknown): (number | null)[] {
  const source = Array.isArray(raw) ? raw : [];
  return Array.from({ length: QUESTION_COUNT }, (_, index) => {
    const value = Number(source[index]);
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  });
}

function totalOf(scores: (number | null)[]): number {
  let sum = 0;
  for (const score of scores) {
    if (score == null) return 0;
    sum += score;
  }
  return sum;
}

/** Shape of the payload: { scores: { [studentId]: number[] } }. */
function collectScores(
  raw: unknown,
  students: { id: number }[],
): Map<number, { scores: (number | null)[]; total: number }> {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const map = new Map<number, { scores: (number | null)[]; total: number }>();
  for (const student of students) {
    const scores = normalizeScores(source[String(student.id)]);
    map.set(student.id, { scores, total: totalOf(scores) });
  }
  return map;
}

async function saveScoreRows(
  evalId: number,
  scores: Map<number, { scores: (number | null)[]; total: number }>,
): Promise<void> {
  for (const [studentId, entry] of scores) {
    const serialized = JSON.stringify(entry.scores);
    const updated = await sql(
      `UPDATE group_instructor_eval_scores SET scores=?, total=? WHERE eval_id=? AND student_id=?`,
      serialized, entry.total, evalId, studentId,
    );
    if (Number(updated.rowsAffected) === 0) {
      await sql(
        `INSERT INTO group_instructor_eval_scores (eval_id, student_id, scores, total) VALUES (?,?,?,?)`,
        evalId, studentId, serialized, entry.total,
      );
    }
  }
}

async function ensureEvalRow(groupId: number, instructorId: number): Promise<number> {
  const existing = await loadEvalRow(groupId);
  if (existing) return Number(existing.id);
  const result = await sql(
    `INSERT INTO group_instructor_evals (group_id, instructor_user_id, status) VALUES (?,?,'draft')`,
    groupId, instructorId,
  );
  return Number(result.lastInsertRowid);
}

/**
 * Full definition + saved progress for the signed-in instructor.
 * `status` is `not_open` until the group is completed.
 */
export async function getInstructorEvaluation(instructorId: number, groupId: number): Promise<any> {
  const group = await loadGroupForInstructor(instructorId, groupId);
  const completed = isGroupCompleted(group);
  const evalRow = await loadEvalRow(groupId);
  const students = await loadStudents(groupId);
  const scoreRows = evalRow
    ? await loadScoreRows(Number(evalRow.id))
    : new Map<number, { scores: (number | null)[]; total: number }>();
  const submitted = evalRow?.status === 'submitted';

  const studentRows = students.map((student) => {
    const saved = scoreRows.get(student.id);
    const scores: (number | null)[] = saved?.scores ?? Array(QUESTION_COUNT).fill(null);
    return {
      id: student.id,
      name: student.name,
      scores,
      total: scores.every((score) => score != null) ? totalOf(scores) : null,
      complete: scores.every((score) => score != null),
    };
  });

  let status: 'not_open' | 'draft' | 'submitted';
  if (submitted) status = 'submitted';
  else if (!completed) status = 'not_open';
  else status = 'draft';

  return {
    group: {
      id: group.id,
      name: group.name,
      course_title: group.course_title,
      course_mode: group.course_mode,
      start_date: group.start_date,
      instructor_name: group.instructor_name,
      place_name: group.place_name,
      completed_at: group.completed_at,
      eval_opened_at: group.eval_opened_at,
    },
    questions: buildQuestions(group.course_mode),
    scale: EVAL_SCALE,
    students: studentRows,
    status,
    submitted_at: evalRow?.submitted_at || null,
    students_count: studentRows.length,
    completed_count: studentRows.filter((row) => row.complete).length,
    can_edit: status === 'draft' && studentRows.length > 0,
  };
}

/** Save progress without closing the evaluation. */
export async function saveInstructorEvaluationDraft(
  instructorId: number,
  groupId: number,
  rawScores: unknown,
): Promise<any> {
  const group = await loadGroupForInstructor(instructorId, groupId);
  if (!isGroupCompleted(group)) {
    throw { status: 400, message: 'تقييم الطلاب يُفتح بعد إنهاء المجموعة' };
  }
  const evalRow = await loadEvalRow(groupId);
  if (evalRow?.status === 'submitted') {
    throw { status: 400, message: 'تم إرسال التقييم بالفعل — اطلب من الإدارة إعادة فتحه' };
  }

  const students = await loadStudents(groupId);
  if (students.length === 0) {
    throw { status: 400, message: 'لا يوجد طلاب في هذه المجموعة' };
  }
  const evalId = await ensureEvalRow(groupId, instructorId);
  const scores = collectScores(rawScores, students);
  await saveScoreRows(evalId, scores);
  await sql(
    `UPDATE group_instructor_evals SET updated_at=datetime('now'), instructor_user_id=? WHERE id=?`,
    instructorId, evalId,
  );

  return getInstructorEvaluation(instructorId, groupId);
}

/** Final submission — every student must have all four scores. */
export async function submitInstructorEvaluation(
  instructorId: number,
  groupId: number,
  rawScores: unknown,
): Promise<any> {
  const group = await loadGroupForInstructor(instructorId, groupId);
  if (!isGroupCompleted(group)) {
    throw { status: 400, message: 'تقييم الطلاب يُفتح بعد إنهاء المجموعة' };
  }
  const evalRow = await loadEvalRow(groupId);
  if (evalRow?.status === 'submitted') {
    throw { status: 400, message: 'تم إرسال التقييم بالفعل — إرسال واحد لكل مجموعة' };
  }

  const students = await loadStudents(groupId);
  if (students.length === 0) {
    throw { status: 400, message: 'لا يوجد طلاب في هذه المجموعة' };
  }

  const scores = collectScores(rawScores, students);
  const missing = students.filter((student) => scores.get(student.id)?.total === 0);
  if (missing.length > 0) {
    throw {
      status: 400,
      message: `أكمل تقييم جميع الطلاب قبل الإرسال — متبقٍ ${missing.length} طالب`,
      missing: missing.map((student) => student.id),
    };
  }

  const evalId = await ensureEvalRow(groupId, instructorId);
  await saveScoreRows(evalId, scores);
  await sql(
    `UPDATE group_instructor_evals
     SET status='submitted', submitted_at=datetime('now'), updated_at=datetime('now'), instructor_user_id=?
     WHERE id=? AND status='draft'`,
    instructorId, evalId,
  );

  await notifyAdminsOfSubmission(group, instructorId).catch((error) =>
    console.error('[InstructorEval] Admin notification failed:', error?.message || error),
  );

  return getInstructorEvaluation(instructorId, groupId);
}

async function notifyAdminsOfSubmission(group: EvalGroup, instructorId: number): Promise<void> {
  const instructor = await sql('SELECT name FROM users WHERE id=?', instructorId);
  const instructorName = (instructor.rows[0] as any)?.name || 'المحاضر';
  const admins = await sql('SELECT id FROM users WHERE role_id=1 AND is_active=1');
  for (const row of admins.rows as any[]) {
    const adminId = Number(row.id);
    await createNotification(
      adminId,
      'اكتمل تقييم المحاضر للطلاب',
      `${instructorName} أرسل تقييم طلاب مجموعة "${group.name}" في كورس "${group.course_title}".`,
      'success',
      `/courses/${group.course_id}`,
    ).catch((error) =>
      console.error('[InstructorEval] In-app admin notification failed:', error?.message || error),
    );
    await sendNotification(adminId, 'instructor_eval_submitted', {
      courseTitle: group.course_title,
      groupName: group.name,
      instructorName,
    }).catch((error) =>
      console.error('[InstructorEval] External admin notification failed:', error?.message || error),
    );
  }
}

// ──────────────────────────────────────────────
// Admin
// ──────────────────────────────────────────────

export async function getInstructorEvaluationStatus(groupId: number): Promise<any> {
  const group = await sql(
    `SELECT g.id, g.name, g.status, g.completed_at, g.instructor_user_id,
            u.name as instructor_name
     FROM groups g LEFT JOIN users u ON g.instructor_user_id=u.id
     WHERE g.id=?`,
    groupId,
  );
  if (group.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const row = group.rows[0] as any;
  const evalRow = await loadEvalRow(groupId);
  const students = await loadStudents(groupId);
  const scoreRows = evalRow
    ? await loadScoreRows(Number(evalRow.id))
    : new Map<number, { scores: (number | null)[]; total: number }>();
  const completedCount = students.filter((student) => {
    const saved = scoreRows.get(student.id);
    return saved?.scores.every((score) => score != null) ?? false;
  }).length;

  return {
    status: evalRow?.status === 'submitted' ? 'submitted' : evalRow ? 'draft' : 'none',
    submitted_at: evalRow?.submitted_at || null,
    updated_at: evalRow?.updated_at || null,
    instructor_user_id: row.instructor_user_id != null ? Number(row.instructor_user_id) : null,
    instructor_name: row.instructor_name || null,
    group_completed: row.status === 'completed',
    students_count: students.length,
    completed_count: completedCount,
    can_reopen: evalRow?.status === 'submitted',
  };
}

/** Only an admin may reopen a submitted evaluation; saved scores are kept. */
export async function reopenInstructorEvaluation(groupId: number): Promise<void> {
  const evalRow = await loadEvalRow(groupId);
  if (!evalRow) throw { status: 404, message: 'لا يوجد تقييم لهذه المجموعة' };
  if (evalRow.status !== 'submitted') {
    throw { status: 400, message: 'التقييم غير مُرسل بعد — لا حاجة لإعادة فتحه' };
  }
  await sql(
    `UPDATE group_instructor_evals
     SET status='draft', submitted_at=NULL, updated_at=datetime('now')
     WHERE group_id=?`,
    groupId,
  );
}
