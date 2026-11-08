import { sql } from '../db/helpers';
import { getGroupSurveyStats } from './surveyService';

/**
 * Group report (edit-plan.md §8).
 *
 * The report is generated from the freshest database state at click time —
 * nothing is stored. Every section of the paper template maps to a field here,
 * and the report settings hold the fixed/default texts the admin can edit.
 */

export interface ReportSettings {
  coordinatorName: string;
  organizerText: string;
  certificateText: string;
  defaultNotes: string;
  defaultRecommendations: string;
  defaultActivityType: string;
}

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  coordinatorName: 'د/ شيماء عبد الدايم (مدير وحدة التدريب و التطوير)',
  organizerText: 'وحدة التدريب و التطوير بالمعهد',
  certificateText:
    'تم حصول المتدربين على شهادات معتمدة من المعهد ووحدة التدريب و التطوير باجتياز الدورة التدريبية.',
  defaultNotes:
    'وجود مقرر الدورة بشكل pdf وتم إرساله للمشاركين قبل بداية الدورة. إتاحة النقاش والاستفسارات لجميع المشاركين مباشرة مع المدرب.',
  defaultRecommendations:
    'أوصى المتدربين بحضور دورات تدريبية أخرى من خلال وحدة التدريب و التطوير بالمعهد.',
  defaultActivityType: 'غير ربحي ( منحة من المعهد ) / وظيفي',
};

const SETTINGS_KEY = 'reportSettings';

function text(value: unknown, fallback: string, max = 4000): string {
  if (value === null || value === undefined) return fallback;
  const trimmed = String(value).trim();
  return (trimmed || fallback).slice(0, max);
}

export async function getReportSettings(): Promise<ReportSettings> {
  try {
    const result = await sql('SELECT value FROM system_settings WHERE key=?', SETTINGS_KEY);
    if (result.rows.length === 0) return { ...DEFAULT_REPORT_SETTINGS };
    const parsed = JSON.parse(String((result.rows[0] as any).value || '{}')) || {};
    return {
      coordinatorName: text(parsed.coordinatorName, DEFAULT_REPORT_SETTINGS.coordinatorName, 200),
      organizerText: text(parsed.organizerText, DEFAULT_REPORT_SETTINGS.organizerText, 300),
      certificateText: text(parsed.certificateText, DEFAULT_REPORT_SETTINGS.certificateText, 2000),
      defaultNotes: text(parsed.defaultNotes, DEFAULT_REPORT_SETTINGS.defaultNotes, 4000),
      defaultRecommendations: text(
        parsed.defaultRecommendations,
        DEFAULT_REPORT_SETTINGS.defaultRecommendations,
        4000,
      ),
      defaultActivityType: text(
        parsed.defaultActivityType,
        DEFAULT_REPORT_SETTINGS.defaultActivityType,
        300,
      ),
    };
  } catch {
    return { ...DEFAULT_REPORT_SETTINGS };
  }
}

export async function saveReportSettings(patch: Partial<ReportSettings>): Promise<ReportSettings> {
  const current = await getReportSettings();
  const next: ReportSettings = {
    coordinatorName: text(patch.coordinatorName, current.coordinatorName, 200),
    organizerText: text(patch.organizerText, current.organizerText, 300),
    certificateText: text(patch.certificateText, current.certificateText, 2000),
    defaultNotes: text(patch.defaultNotes, current.defaultNotes, 4000),
    defaultRecommendations: text(
      patch.defaultRecommendations,
      current.defaultRecommendations,
      4000,
    ),
    defaultActivityType: text(patch.defaultActivityType, current.defaultActivityType, 300),
  };
  await sql(
    'INSERT INTO system_settings (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP',
    SETTINGS_KEY,
    JSON.stringify(next),
    JSON.stringify(next),
  );
  return next;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function parseJsonArray<T>(value: unknown): T[] {
  try {
    const parsed = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

/** "أحد، اثنين، …" for a lecture date; falls back to the raw string. */
const ARABIC_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function arabicWeekday(date: unknown): string {
  if (!date) return '';
  const raw = String(date).trim();
  const normalized = raw.includes('T') ? raw : `${raw.slice(0, 10)}T00:00:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? '' : ARABIC_WEEKDAYS[parsed.getDay()];
}

function clock(value: unknown): string {
  if (!value) return '';
  return String(value).slice(0, 5);
}

export interface ReportLecture {
  id: number;
  date: string;
  weekday: string;
  time_from: string;
  time_to: string;
  topic: string;
  location: string;
}

export interface ReportStudent {
  id: number;
  name: string;
  unit: string;
  email: string;
}

export interface GroupReport {
  completed: boolean;
  group: {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    course_mode: string;
    instructor_name: string;
    activity_type: string;
    notes: string;
    recommendations: string;
    place_name: string;
    location: string;
    time_range: string;
    days_text: string;
  };
  course: {
    id: number;
    title_ar: string;
    title_en: string;
    introduction: string;
    description: string;
    objectives: string[];
    daily_content: { day: string; topic: string; instructor: string }[];
    target_audience: string;
    lecture_count: number;
    lecture_duration: number;
    course_mode: string;
  };
  lectures: ReportLecture[];
  students: ReportStudent[];
  survey: any | null;
  settings: ReportSettings;
  generated_at: string;
}

export async function buildGroupReport(groupId: number): Promise<GroupReport> {
  const groupResult = await sql(
    `SELECT g.*, c.title_ar, c.title_en, c.description AS course_description,
            c.introduction, c.objectives, c.daily_content, c.target_audience,
            c.lecture_count AS course_lecture_count, c.lecture_duration,
            c.course_mode AS course_mode, p.name AS place_name
     FROM groups g
     JOIN courses c ON g.course_id = c.id
     LEFT JOIN places p ON g.place_id = p.id
     WHERE g.id = ?`,
    groupId,
  );
  if (groupResult.rows.length === 0) throw { status: 404, message: 'المجموعة غير موجودة' };
  const row = groupResult.rows[0] as any;

  const settings = await getReportSettings();

  const lecturesResult = await sql(
    `SELECT id, date, time_from, time_to, topic, location
     FROM lectures WHERE group_id = ? ORDER BY date ASC, sort_order ASC, id ASC`,
    groupId,
  );
  const lectures: ReportLecture[] = (lecturesResult.rows as any[]).map((lecture) => ({
    id: Number(lecture.id),
    date: lecture.date ? String(lecture.date).slice(0, 10) : '',
    weekday: arabicWeekday(lecture.date),
    time_from: clock(lecture.time_from),
    time_to: clock(lecture.time_to),
    topic: String(lecture.topic || ''),
    location: String(lecture.location || ''),
  }));

  const studentsResult = await sql(
    `SELECT u.id, u.name, u.email, u.university_name
     FROM group_students gs JOIN users u ON gs.user_id = u.id
     WHERE gs.group_id = ? ORDER BY u.name ASC`,
    groupId,
  );
  const students: ReportStudent[] = (studentsResult.rows as any[]).map((student) => ({
    id: Number(student.id),
    name: String(student.name || ''),
    unit: String(student.university_name || ''),
    email: String(student.email || ''),
  }));

  const objectives = parseJsonArray<{ text?: string } | string>(row.objectives)
    .map((item) => (typeof item === 'string' ? item : String(item?.text || '')))
    .map((item) => item.trim())
    .filter(Boolean);

  const dailyContent = parseJsonArray<{ day?: string; topic?: string; instructor?: string }>(
    row.daily_content,
  ).map((item) => ({
    day: String(item?.day || ''),
    topic: String(item?.topic || ''),
    instructor: String(item?.instructor || ''),
  }));

  const timeSlots = new Map<string, string>();
  for (const lecture of lectures) {
    if (lecture.time_from || lecture.time_to) {
      timeSlots.set(`${lecture.time_from}-${lecture.time_to}`, `${lecture.time_from} — ${lecture.time_to}`);
    }
  }

  const courseMode = String(row.course_mode || 'online');
  const offline = courseMode === 'offline';

  let survey: any | null = null;
  try {
    survey = await getGroupSurveyStats(groupId);
  } catch {
    survey = null;
  }

  return {
    completed:
      row.status === 'completed' || Number(row.is_complete) === 1 || Boolean(row.completed_at),
    group: {
      id: Number(row.id),
      name: String(row.name || ''),
      start_date: row.start_date ? String(row.start_date).slice(0, 10) : '',
      end_date: row.end_date ? String(row.end_date).slice(0, 10) : '',
      course_mode: courseMode,
      instructor_name: String(row.instructor_name || ''),
      activity_type: text(row.activity_type, settings.defaultActivityType, 300),
      notes: text(row.report_notes, settings.defaultNotes, 4000),
      recommendations: text(
        row.report_recommendations,
        settings.defaultRecommendations,
        4000,
      ),
      place_name: offline ? String(row.place_name || row.location || '') : 'أونلاين',
      location: String(row.location || ''),
      time_range: Array.from(timeSlots.values()).join(' / '),
      days_text: lectures
        .map((lecture) => `${lecture.weekday ? `${lecture.weekday} ` : ''}${lecture.date}`.trim())
        .join('، '),
    },
    course: {
      id: Number(row.course_id),
      title_ar: String(row.title_ar || ''),
      title_en: String(row.title_en || ''),
      introduction: String(row.introduction || ''),
      description: String(row.course_description || ''),
      objectives,
      daily_content: dailyContent,
      target_audience: String(row.target_audience || ''),
      lecture_count: Number(row.course_lecture_count || lectures.length || 0),
      lecture_duration: Number(row.lecture_duration || 0),
      course_mode: courseMode,
    },
    lectures,
    students,
    survey,
    settings,
    generated_at: new Date().toISOString(),
  };
}
