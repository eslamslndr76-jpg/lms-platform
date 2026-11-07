import { sql } from '../db/helpers';
import { createNotification } from './notificationService';
import { sendBulkNotifications } from './externalNotificationService';

/**
 * Post-course student survey (edit-plan.md §4.4).
 *
 * The survey lives at the group level: every student of a completed group can
 * answer it once. A draft is auto-saved so the student can resume on any
 * device; submitting locks the answers for good. Answering is optional and has
 * no relation to certificates.
 */

// ──────────────────────────────────────────────
// Survey definition (single source of truth)
// ──────────────────────────────────────────────

export const SURVEY_SCALE = [
  { value: 1, label: 'ضعيف' },
  { value: 2, label: 'متوسط' },
  { value: 3, label: 'جيد' },
  { value: 4, label: 'جيد جداً' },
  { value: 5, label: 'ممتاز' },
];

export const LECTURER_SECTION = { key: 'lecturer', title: 'أولاً: تقييم المحاضر' };
export const PROGRAM_SECTION = { key: 'program', title: 'ثانياً: تقييم البرنامج التدريبي' };

export const LECTURER_ITEMS = [
  { key: 'lecturer_knowledge', label: 'إلمام المدرب بمواضيع البرنامج' },
  { key: 'lecturer_communication', label: 'قدرة المدرب على توصيل المعلومات' },
  { key: 'lecturer_organization', label: 'طريقة تنظيم العرض (من حيث الوضوح والكفاية)' },
  { key: 'lecturer_cooperation', label: 'مدى تعاونه مع المتدربين' },
  { key: 'lecturer_motivation', label: 'قدرة المدرب على تحفيز المشاركين على التفاعل' },
];

export const PROGRAM_ITEMS = [
  { key: 'program_content', label: 'محتوى البرنامج التدريبي' },
  { key: 'program_materials', label: 'المادة التدريبية التي تم عرضها في البرنامج' },
  { key: 'program_material_organization', label: 'تنظيم وسهولة محتوى المادة العلمية' },
  { key: 'program_goals', label: 'تحقيق أهداف البرنامج' },
  { key: 'program_organization', label: 'مستوى تنظيم البرنامج التدريبي' },
  { key: 'program_duration', label: 'مدة البرنامج والتوقيت' },
];

/** Offline groups only. Hidden for online groups. */
export const PLACE_ITEM = { key: 'program_place', label: 'مكان البرنامج' };

export const HELPED_ITEM = {
  key: 'helped_develop',
  label: 'هل البرنامج ساعدك على تطوير مهاراتك؟',
};

export const NOTES_LABEL = 'رابعاً: الاقتراحات والملاحظات';

export interface SurveySettings {
  openDays: number;
  reminder1Days: number;
  reminder2Days: number;
}

export const DEFAULT_SURVEY_SETTINGS: SurveySettings = {
  openDays: 30,
  reminder1Days: 2,
  reminder2Days: 5,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function getSurveySettings(): Promise<SurveySettings> {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='surveySettings'");
    if (result.rows.length === 0) return { ...DEFAULT_SURVEY_SETTINGS };
    const parsed = JSON.parse((result.rows[0] as any).value as string) || {};
    const settings: SurveySettings = {
      openDays: clampInt(parsed.openDays, DEFAULT_SURVEY_SETTINGS.openDays, 1, 365),
      reminder1Days: clampInt(parsed.reminder1Days, DEFAULT_SURVEY_SETTINGS.reminder1Days, 0, 60),
      reminder2Days: clampInt(parsed.reminder2Days, DEFAULT_SURVEY_SETTINGS.reminder2Days, 1, 120),
    };
    if (settings.reminder2Days < settings.reminder1Days) {
      settings.reminder2Days = settings.reminder1Days;
    }
    return settings;
  } catch {
    return { ...DEFAULT_SURVEY_SETTINGS };
  }
}

export async function saveSurveySettings(patch: Partial<SurveySettings>): Promise<SurveySettings> {
  const current = await getSurveySettings();
  const next: SurveySettings = {
    openDays: clampInt(patch.openDays ?? current.openDays, current.openDays, 1, 365),
    reminder1Days: clampInt(patch.reminder1Days ?? current.reminder1Days, current.reminder1Days, 0, 60),
    reminder2Days: clampInt(patch.reminder2Days ?? current.reminder2Days, current.reminder2Days, 1, 120),
  };
  if (next.reminder2Days < next.reminder1Days) {
    throw { status: 400, message: 'التذكير الثاني يجب أن يكون بعد التذكير الأول أو في نفس اليوم' };
  }
  await sql(
    "INSERT INTO system_settings (key, value) VALUES ('surveySettings', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
    JSON.stringify(next), JSON.stringify(next),
  );
  return next;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

export function visibleProgramItems(courseMode: string | null | undefined) {
  const items = [...PROGRAM_ITEMS];
  if (courseMode === 'offline') items.push(PLACE_ITEM);
  return items;
}

export function isAnonymousMode(courseMode: string | null | undefined): boolean {
  return courseMode !== 'offline';
}

function parseDbDate(value: unknown): Date | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
}

interface SurveyContext {
  group_id: number;
  group_name: string;
  course_id: number;
  course_title: string;
  course_mode: string;
  instructor_name: string;
  place_name: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  completed_at: string | null;
  survey_closes_at: string | null;
  lecture_count: number;
  lecture_duration: number;
  student_count: number;
  student_name: string;
}

async function loadContext(userId: number, groupId: number): Promise<SurveyContext> {
  const result = await sql(
    `SELECT g.id as group_id, g.name as group_name, g.course_id,
            c.title_ar as course_title, c.course_mode, c.lecture_duration,
            COALESCE(g.instructor_name, '') as instructor_name,
            p.name as place_name, g.location, g.start_date, g.end_date,
            g.completed_at, g.survey_closes_at,
            (SELECT COUNT(*) FROM lectures l WHERE l.group_id = g.id) as lecture_count,
            (SELECT COUNT(*) FROM group_students gs2 WHERE gs2.group_id = g.id) as student_count,
            u.name as student_name
     FROM group_students gs
     JOIN groups g ON gs.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     JOIN users u ON u.id = gs.user_id
     LEFT JOIN places p ON g.place_id = p.id
     WHERE gs.user_id = ? AND g.id = ?`,
    userId, groupId,
  );
  if (result.rows.length === 0) {
    throw { status: 403, message: 'غير مصرح لك بالوصول إلى هذه المجموعة' };
  }
  const row = result.rows[0] as any;
  return {
    group_id: Number(row.group_id),
    group_name: row.group_name || '',
    course_id: Number(row.course_id),
    course_title: row.course_title || '',
    course_mode: row.course_mode || 'online',
    instructor_name: row.instructor_name || '',
    place_name: row.place_name || null,
    location: row.location || null,
    start_date: row.start_date || null,
    end_date: row.end_date || null,
    completed_at: row.completed_at || null,
    survey_closes_at: row.survey_closes_at || null,
    lecture_count: Number(row.lecture_count || 0),
    lecture_duration: Number(row.lecture_duration || 0),
    student_count: Number(row.student_count || 0),
    student_name: row.student_name || '',
  };
}

/**
 * A group is completed but might predate the survey window (or the window was
 * never set). Give it the configured open window lazily so the student is not
 * locked out and the admin sees a real closing date.
 */
async function ensureWindow(ctx: SurveyContext, settings: SurveySettings): Promise<Date | null> {
  if (!ctx.completed_at) return null;
  const existing = parseDbDate(ctx.survey_closes_at);
  if (existing) return existing;
  const completed = parseDbDate(ctx.completed_at) || new Date();
  const closes = addDays(completed, settings.openDays);
  await sql('UPDATE groups SET survey_closes_at=? WHERE id=?', closes.toISOString(), ctx.group_id);
  return closes;
}

function buildSections(courseMode: string) {
  return [
    { ...LECTURER_SECTION, items: LECTURER_ITEMS },
    { ...PROGRAM_SECTION, items: visibleProgramItems(courseMode) },
  ];
}

function sanitizeAnswers(raw: any, courseMode: string): Record<string, any> {
  const out: Record<string, any> = {};
  const items = [...LECTURER_ITEMS, ...visibleProgramItems(courseMode)];
  for (const item of items) {
    const value = raw?.[item.key];
    if (value === undefined || value === null || value === '') continue;
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= 5) out[item.key] = n;
  }
  if (raw?.helped_develop === 'yes' || raw?.helped_develop === 'no') {
    out.helped_develop = raw.helped_develop;
  }
  if (typeof raw?.notes === 'string') {
    out.notes = raw.notes.slice(0, 4000);
  }
  return out;
}

function missingRequiredItems(answers: Record<string, any>, courseMode: string): string[] {
  const items = [...LECTURER_ITEMS, ...visibleProgramItems(courseMode)];
  const missing = items.filter(item => !answers[item.key]).map(item => item.label);
  if (!answers.helped_develop) missing.push(HELPED_ITEM.label);
  return missing;
}

async function getResponseRow(groupId: number, userId: number): Promise<any | null> {
  const result = await sql(
    'SELECT * FROM group_surveys WHERE group_id=? AND user_id=?',
    groupId, userId,
  );
  return (result.rows[0] as any) || null;
}

function serializeResponse(row: any | null) {
  if (!row) return null;
  let answers: Record<string, any> = {};
  try { answers = JSON.parse(row.answers || '{}'); } catch { answers = {}; }
  return {
    status: row.status,
    is_anonymous: Number(row.is_anonymous) === 1,
    answers,
    current_step: Number(row.current_step || 0),
    updated_at: row.updated_at || null,
    submitted_at: row.submitted_at || null,
  };
}

// ──────────────────────────────────────────────
// Student API
// ──────────────────────────────────────────────

export async function getMySurvey(userId: number, groupId: number): Promise<any> {
  const ctx = await loadContext(userId, groupId);
  const settings = await getSurveySettings();
  const closesAt = await ensureWindow(ctx, settings);
  const now = new Date();
  const response = await getResponseRow(groupId, userId);

  const completed = !!ctx.completed_at || ctx.group_id > 0 && (await sql(
    "SELECT 1 FROM groups WHERE id=? AND status='completed'", ctx.group_id,
  )).rows.length > 0;

  const isSubmitted = response?.status === 'submitted';
  const isClosed = !!closesAt && closesAt.getTime() < now.getTime();
  const available = completed && !isClosed && !isSubmitted;

  let status: 'not_open' | 'closed' | 'submitted' | 'draft' | 'pending';
  if (!completed) status = 'not_open';
  else if (isSubmitted) status = 'submitted';
  else if (isClosed) status = 'closed';
  else if (response) status = 'draft';
  else status = 'pending';

  const daysLeft = closesAt
    ? Math.max(0, Math.ceil((closesAt.getTime() - now.getTime()) / DAY_MS))
    : 0;

  return {
    available,
    status,
    can_edit: available,
    is_closed: isClosed,
    closes_at: closesAt ? closesAt.toISOString() : null,
    days_left: daysLeft,
    group: {
      id: ctx.group_id,
      name: ctx.group_name,
      course_id: ctx.course_id,
      course_title: ctx.course_title,
      course_mode: ctx.course_mode,
      instructor_name: ctx.instructor_name,
      place_name: ctx.place_name,
      location: ctx.location,
      start_date: ctx.start_date,
      end_date: ctx.end_date,
      completed_at: ctx.completed_at,
      lecture_count: ctx.lecture_count,
      lecture_duration: ctx.lecture_duration,
    },
    student: { name: ctx.student_name },
    sections: buildSections(ctx.course_mode),
    helped: HELPED_ITEM,
    notes_label: NOTES_LABEL,
    scale: SURVEY_SCALE,
    settings: { openDays: settings.openDays },
    response: serializeResponse(response),
  };
}

export async function saveSurveyDraft(
  userId: number,
  groupId: number,
  payload: { answers?: any; is_anonymous?: boolean; current_step?: number },
): Promise<any> {
  const ctx = await loadContext(userId, groupId);
  const settings = await getSurveySettings();
  const closesAt = await ensureWindow(ctx, settings);
  const now = new Date();
  if (!ctx.completed_at) throw { status: 400, message: 'الاستبيان يُفتح بعد إنهاء المجموعة' };
  if (closesAt && closesAt.getTime() < now.getTime()) {
    throw { status: 400, message: 'انتهت مدة الاستبيان وأُغلق تلقائياً' };
  }

  const existing = await getResponseRow(groupId, userId);
  if (existing?.status === 'submitted') {
    throw { status: 400, message: 'تم إرسال إجابتك بالفعل ولا يمكن تعديلها' };
  }

  const answers = sanitizeAnswers(payload.answers, ctx.course_mode);
  const isAnonymous = payload.is_anonymous ? 1 : 0;
  const currentStep = Math.max(0, Math.min(10, Math.round(Number(payload.current_step) || 0)));

  if (existing) {
    await sql(
      `UPDATE group_surveys
       SET is_anonymous=?, answers=?, current_step=?, updated_at=datetime('now')
       WHERE group_id=? AND user_id=? AND status='draft'`,
      isAnonymous, JSON.stringify(answers), currentStep, groupId, userId,
    );
  } else {
    await sql(
      `INSERT INTO group_surveys (group_id, user_id, is_anonymous, status, answers, current_step)
       VALUES (?,?,?,'draft',?,?)`,
      groupId, userId, isAnonymous, JSON.stringify(answers), currentStep,
    );
  }

  const saved = await getResponseRow(groupId, userId);
  return serializeResponse(saved);
}

export async function submitSurvey(
  userId: number,
  groupId: number,
  payload: { answers?: any; is_anonymous?: boolean },
): Promise<any> {
  const ctx = await loadContext(userId, groupId);
  const settings = await getSurveySettings();
  const closesAt = await ensureWindow(ctx, settings);
  const now = new Date();
  if (!ctx.completed_at) throw { status: 400, message: 'الاستبيان يُفتح بعد إنهاء المجموعة' };
  if (closesAt && closesAt.getTime() < now.getTime()) {
    throw { status: 400, message: 'انتهت مدة الاستبيان وأُغلق تلقائياً' };
  }

  const existing = await getResponseRow(groupId, userId);
  if (existing?.status === 'submitted') {
    throw { status: 400, message: 'تم إرسال إجابتك بالفعل — إجابة واحدة لكل طالب' };
  }

  const answers = sanitizeAnswers(payload.answers, ctx.course_mode);
  const missing = missingRequiredItems(answers, ctx.course_mode);
  if (missing.length > 0) {
    throw {
      status: 400,
      message: `أكمل جميع البنود قبل الإرسال — متبقي: ${missing.slice(0, 3).join('، ')}${missing.length > 3 ? '…' : ''}`,
      missing,
    };
  }

  const isAnonymous = payload.is_anonymous ? 1 : 0;
  if (existing) {
    await sql(
      `UPDATE group_surveys
       SET is_anonymous=?, answers=?, status='submitted', submitted_at=datetime('now'), updated_at=datetime('now')
       WHERE group_id=? AND user_id=? AND status='draft'`,
      isAnonymous, JSON.stringify(answers), groupId, userId,
    );
  } else {
    await sql(
      `INSERT INTO group_surveys (group_id, user_id, is_anonymous, status, answers, submitted_at)
       VALUES (?,?,?,'submitted',?,datetime('now'))`,
      groupId, userId, isAnonymous, JSON.stringify(answers),
    );
  }

  const saved = await getResponseRow(groupId, userId);
  return serializeResponse(saved);
}

/**
 * Every completed group the student belongs to, annotated with the survey
 * state. Used by the dashboard "قيّم دورتك" card.
 */
export async function getPendingSurveys(userId: number): Promise<any[]> {
  const settings = await getSurveySettings();
  const result = await sql(
    `SELECT g.id, g.name, g.completed_at, g.survey_closes_at,
            c.title_ar as course_title, c.course_mode,
            s.status as response_status, s.updated_at as response_updated_at,
            s.submitted_at
     FROM group_students gs
     JOIN groups g ON gs.group_id = g.id
     JOIN courses c ON g.course_id = c.id
     LEFT JOIN group_surveys s ON s.group_id = g.id AND s.user_id = gs.user_id
     WHERE gs.user_id = ? AND g.status = 'completed'
     ORDER BY g.completed_at DESC`,
    userId,
  );

  const now = new Date();
  return result.rows.map((raw: any) => {
    let closesAt = parseDbDate(raw.survey_closes_at);
    if (!closesAt) {
      const completed = parseDbDate(raw.completed_at) || now;
      closesAt = addDays(completed, settings.openDays);
    }
    const isClosed = closesAt.getTime() < now.getTime();
    const submitted = raw.response_status === 'submitted';
    const status = submitted ? 'submitted' : isClosed ? 'closed' : raw.response_status === 'draft' ? 'draft' : 'pending';
    return {
      group_id: Number(raw.id),
      group_name: raw.name,
      course_title: raw.course_title,
      course_mode: raw.course_mode,
      completed_at: raw.completed_at,
      closes_at: closesAt.toISOString(),
      days_left: Math.max(0, Math.ceil((closesAt.getTime() - now.getTime()) / DAY_MS)),
      status,
      answered_at: raw.submitted_at || null,
      updated_at: raw.response_updated_at || null,
    };
  });
}

// ──────────────────────────────────────────────
// Admin API
// ──────────────────────────────────────────────

export async function getGroupSurveyStats(groupId: number): Promise<any> {
  const groupResult = await sql(
    `SELECT g.id, g.name, g.course_id, g.completed_at, g.survey_closes_at,
            g.survey_reminder1_at, g.survey_reminder2_at,
            c.title_ar as course_title, c.course_mode
     FROM groups g JOIN courses c ON g.course_id = c.id WHERE g.id=?`,
    groupId,
  );
  if (groupResult.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const group = groupResult.rows[0] as any;

  const students = await sql(
    'SELECT COUNT(*) as total FROM group_students WHERE group_id=?',
    groupId,
  );
  const totalStudents = Number((students.rows[0] as any)?.total || 0);

  const responses = await sql(
    `SELECT s.*, u.name as student_name
     FROM group_surveys s
     JOIN users u ON u.id = s.user_id
     WHERE s.group_id = ? AND s.status = 'submitted'
     ORDER BY s.submitted_at ASC`,
    groupId,
  );

  const submitted = responses.rows as any[];
  const answered = submitted.length;
  const pending = Math.max(0, totalStudents - answered);
  const courseMode = group.course_mode || 'online';

  const itemDefs = [
    ...LECTURER_ITEMS.map(item => ({ ...item, section: 'lecturer', sectionTitle: LECTURER_SECTION.title })),
    ...visibleProgramItems(courseMode).map(item => ({ ...item, section: 'program', sectionTitle: PROGRAM_SECTION.title })),
  ];

  const parsedResponses = submitted.map(row => {
    let answers: Record<string, any> = {};
    try { answers = JSON.parse(row.answers || '{}'); } catch { answers = {}; }
    return { row, answers };
  });

  const items = itemDefs.map(item => {
    const values = parsedResponses
      .map(r => r.answers[item.key])
      .filter(v => typeof v === 'number' && v >= 1 && v <= 5) as number[];
    return {
      key: item.key,
      label: item.label,
      section: item.section,
      section_title: item.sectionTitle,
      avg: average(values),
      count: values.length,
    };
  });

  const sectionStats = [LECTURER_SECTION, PROGRAM_SECTION].map(section => {
    const sectionItems = items.filter(i => i.section === section.key && i.avg !== null);
    const avg = sectionItems.length > 0
      ? round2(sectionItems.reduce((sum, i) => sum + (i.avg as number), 0) / sectionItems.length)
      : null;
    return { key: section.key, title: section.title, avg, items: sectionItems.length };
  });

  const ratedItems = items.filter(i => i.avg !== null);
  const overallAvg = ratedItems.length > 0
    ? round2(ratedItems.reduce((sum, i) => sum + (i.avg as number), 0) / ratedItems.length)
    : null;

  let helpedYes = 0;
  let helpedNo = 0;
  for (const r of parsedResponses) {
    if (r.answers.helped_develop === 'yes') helpedYes++;
    else if (r.answers.helped_develop === 'no') helpedNo++;
  }
  const helpedTotal = helpedYes + helpedNo;

  const responseList = parsedResponses.map(({ row, answers }) => ({
    is_anonymous: Number(row.is_anonymous) === 1,
    student_name: Number(row.is_anonymous) === 1 ? null : row.student_name,
    submitted_at: row.submitted_at,
    answers,
  }));

  return {
    group: {
      id: Number(group.id),
      name: group.name,
      course_id: Number(group.course_id),
      course_title: group.course_title,
      course_mode: courseMode,
      completed_at: group.completed_at,
      closes_at: group.survey_closes_at,
      reminder1_at: group.survey_reminder1_at,
      reminder2_at: group.survey_reminder2_at,
    },
    total_students: totalStudents,
    answered,
    pending,
    response_rate: totalStudents > 0 ? Math.round((answered / totalStudents) * 100) : 0,
    overall_avg: overallAvg,
    sections: sectionStats,
    items,
    helped: {
      yes: helpedYes,
      no: helpedNo,
      yes_percent: helpedTotal > 0 ? Math.round((helpedYes / helpedTotal) * 100) : null,
    },
    responses: responseList,
  };
}

export async function extendSurveyWindow(groupId: number, closesAt: string): Promise<{ closes_at: string }> {
  const group = await sql('SELECT id, status, completed_at FROM groups WHERE id=?', groupId);
  if (group.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const row = group.rows[0] as any;
  if (row.status !== 'completed') {
    throw { status: 400, message: 'الاستبيان يُفتح بعد إنهاء المجموعة' };
  }
  const parsed = parseDbDate(closesAt);
  if (!parsed) throw { status: 400, message: 'تاريخ الإغلاق غير صالح' };
  await sql('UPDATE groups SET survey_closes_at=? WHERE id=?', parsed.toISOString(), groupId);
  return { closes_at: parsed.toISOString() };
}

// ──────────────────────────────────────────────
// Reminders + window lifecycle
// ──────────────────────────────────────────────

interface ReminderRecipient {
  user_id: number;
  name: string;
}

async function getPendingRecipients(groupId: number): Promise<ReminderRecipient[]> {
  const result = await sql(
    `SELECT gs.user_id, u.name
     FROM group_students gs
     JOIN users u ON u.id = gs.user_id
     LEFT JOIN group_surveys s ON s.group_id = gs.group_id AND s.user_id = gs.user_id
     WHERE gs.group_id = ? AND (s.status IS NULL OR s.status <> 'submitted')`,
    groupId,
  );
  return result.rows.map((r: any) => ({ user_id: Number(r.user_id), name: r.name || '' }));
}

export async function sendSurveyReminder(
  groupId: number,
  reason: 'manual' | 'reminder1' | 'reminder2' = 'manual',
): Promise<{ sent: number; pending: number }> {
  const groupResult = await sql(
    `SELECT g.id, g.name, g.status, g.survey_closes_at, c.title_ar as course_title
     FROM groups g JOIN courses c ON g.course_id = c.id WHERE g.id=?`,
    groupId,
  );
  if (groupResult.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const group = groupResult.rows[0] as any;
  if (group.status !== 'completed') {
    throw { status: 400, message: 'الاستبيان يُفتح بعد إنهاء المجموعة' };
  }

  const closesAt = parseDbDate(group.survey_closes_at);
  if (closesAt && closesAt.getTime() < Date.now()) {
    throw { status: 400, message: 'انتهت مدة الاستبيان — مدّد المدة أولاً قبل التذكير' };
  }

  const recipients = await getPendingRecipients(groupId);
  if (recipients.length === 0) return { sent: 0, pending: 0 };

  const title = reason === 'manual' ? 'تذكير: قيّم دورتك' : 'تذكير بسيط: قيّم دورتك';
  for (const recipient of recipients) {
    await createNotification(
      recipient.user_id,
      title,
      `رأيك في مجموعة "${group.name}" يساعدنا على التحسين — يستغرق نحو دقيقتين فقط.`,
      'info',
      `/survey/${groupId}`,
    ).catch(e => console.error('[Notify] survey reminder in-app failed:', e.message));
  }

  await sendBulkNotifications(
    recipients.map(r => r.user_id),
    'survey_reminder',
    {
      groupId,
      groupName: group.name || '',
      courseTitle: group.course_title || '',
      reason,
    },
  ).catch(e => console.error('[Notify] survey reminder external failed:', e.message));

  return { sent: recipients.length, pending: recipients.length };
}

/**
 * Sends the two configured reminders (2 days and 5 days after completion by
 * default) to non-responders only. Safe to call repeatedly: each reminder is
 * stamped on the group and never sent twice.
 */
export async function runSurveyReminderSweep(): Promise<{ reminder1: number; reminder2: number }> {
  const settings = await getSurveySettings();
  const result = await sql(
    `SELECT id, completed_at, survey_closes_at, survey_reminder1_at, survey_reminder2_at
     FROM groups
     WHERE status='completed' AND completed_at IS NOT NULL AND survey_closes_at IS NOT NULL`,
  );

  let reminder1 = 0;
  let reminder2 = 0;
  const now = Date.now();

  for (const raw of result.rows as any[]) {
    const groupId = Number(raw.id);
    const completedAt = parseDbDate(raw.completed_at);
    const closesAt = parseDbDate(raw.survey_closes_at);
    if (!completedAt || !closesAt) continue;
    if (closesAt.getTime() < now) continue;

    const due1 = addDays(completedAt, settings.reminder1Days).getTime();
    const due2 = addDays(completedAt, settings.reminder2Days).getTime();

    if (!raw.survey_reminder1_at && now >= due1) {
      try {
        const { sent } = await sendSurveyReminder(groupId, 'reminder1');
        reminder1 += sent;
      } catch (e: any) {
        console.error('[Survey] reminder1 failed for group', groupId, ':', e?.message || e);
      }
      await sql('UPDATE groups SET survey_reminder1_at=datetime(\'now\') WHERE id=?', groupId);
      // Leave the second reminder for the next sweep so they never arrive together.
      continue;
    }

    if (raw.survey_reminder1_at && !raw.survey_reminder2_at && now >= due2) {
      try {
        const { sent } = await sendSurveyReminder(groupId, 'reminder2');
        reminder2 += sent;
      } catch (e: any) {
        console.error('[Survey] reminder2 failed for group', groupId, ':', e?.message || e);
      }
      await sql('UPDATE groups SET survey_reminder2_at=datetime(\'now\') WHERE id=?', groupId);
    }
  }

  return { reminder1, reminder2 };
}

/** Called when a group is officially completed: opens the survey window. */
export async function openSurveyWindow(groupId: number): Promise<{ closes_at: string }> {
  const settings = await getSurveySettings();
  const closes = addDays(new Date(), settings.openDays);
  await sql(
    'UPDATE groups SET survey_closes_at=?, survey_reminder1_at=NULL, survey_reminder2_at=NULL WHERE id=?',
    closes.toISOString(), groupId,
  );
  return { closes_at: closes.toISOString() };
}

/** Called when a group is reopened: the survey closes with it. */
export async function resetSurveyWindow(groupId: number): Promise<void> {
  await sql(
    'UPDATE groups SET survey_closes_at=NULL, survey_reminder1_at=NULL, survey_reminder2_at=NULL WHERE id=?',
    groupId,
  );
}
