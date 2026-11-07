import { sql } from '../db/helpers';
import { createNotification } from './notificationService';
import { isEmailEnabled, sendGenericEmail } from './emailService';
import { isTelegramEnabled, sendGenericTelegram } from './telegramService';
import { getFrontendUrl } from '../config/notification';

/**
 * New-course announcements (edit-plan.md §7).
 *
 * The text is built from the course data and reviewed by staff before sending.
 * Every account receives the in-app notification and the email; Telegram is
 * added for accounts that linked it. Auto-send happens once, when a course is
 * published, and is controlled from the settings page.
 */

export interface AnnouncementSettings {
  autoEnabled: boolean;
}

export interface AnnouncementContent {
  title: string;
  body: string;
}

export interface AnnouncementPreview extends AnnouncementContent {
  course_id: number;
  course_title: string;
  sent_at: string | null;
  recipients: number;
}

const FRONTEND_URL = getFrontendUrl();

export async function getAnnouncementSettings(): Promise<AnnouncementSettings> {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='announcement'");
    if (result.rows.length === 0) return { autoEnabled: false };
    const parsed = JSON.parse(String((result.rows[0] as any).value || '{}'));
    return { autoEnabled: Boolean(parsed.autoEnabled) };
  } catch {
    return { autoEnabled: false };
  }
}

export async function saveAnnouncementSettings(settings: AnnouncementSettings): Promise<AnnouncementSettings> {
  const value = JSON.stringify({ autoEnabled: Boolean(settings.autoEnabled) });
  const existing = await sql("SELECT id FROM system_settings WHERE key='announcement'");
  if (existing.rows.length > 0) {
    await sql("UPDATE system_settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='announcement'", value);
  } else {
    await sql("INSERT INTO system_settings (key, value) VALUES ('announcement', ?)", value);
  }
  return { autoEnabled: Boolean(settings.autoEnabled) };
}

interface CourseInfo {
  id: number;
  title_ar: string;
  description: string | null;
  price: number;
  announcement_sent_at: string | null;
  start_date: string | null;
}

async function loadCourse(courseId: number): Promise<CourseInfo> {
  const result = await sql(
    `SELECT c.id, c.title_ar, c.description, c.price, c.announcement_sent_at,
            (SELECT MIN(g.start_date) FROM groups g
              WHERE g.course_id=c.id AND g.start_date IS NOT NULL) as start_date
     FROM courses c WHERE c.id=?`,
    courseId,
  );
  if (result.rows.length === 0) throw { status: 404, message: 'الكورس غير موجود' };
  const row = result.rows[0] as any;
  return {
    id: Number(row.id),
    title_ar: row.title_ar || '',
    description: row.description || '',
    price: Number(row.price) || 0,
    announcement_sent_at: row.announcement_sent_at || null,
    start_date: row.start_date || null,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const raw = String(value);
  const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function truncate(value: string, max: number): string {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function buildAnnouncementContent(course: CourseInfo): AnnouncementContent {
  const lines = [`كورس جديد نازل! 🎓`, '', `«${course.title_ar}»`];
  if (course.description) lines.push('', truncate(course.description, 220));
  if (course.start_date) lines.push('', `📅 يبدأ: ${formatDate(course.start_date)}`);
  lines.push(`💰 ${course.price > 0 ? `الرسوم: ${course.price} جنيه` : 'التسجيل مجاني'}`);
  lines.push('', 'لو حابب تشترك فيه، سجّل من حسابك:', `${FRONTEND_URL}/courses/${course.id}`);
  return {
    title: `كورس جديد: ${course.title_ar}`,
    body: lines.join('\n'),
  };
}

async function countRecipients(): Promise<number> {
  const result = await sql(
    'SELECT COUNT(*) as count FROM users WHERE is_active=1 AND role_id IN (1,2,3)',
  );
  return Number((result.rows[0] as any)?.count || 0);
}

export async function getAnnouncementPreview(courseId: number): Promise<AnnouncementPreview> {
  const course = await loadCourse(courseId);
  const content = buildAnnouncementContent(course);
  return {
    ...content,
    course_id: course.id,
    course_title: course.title_ar,
    sent_at: course.announcement_sent_at,
    recipients: await countRecipients(),
  };
}

interface SendOptions {
  title?: string;
  body?: string;
  /** Re-send even if an announcement already went out for this course. */
  force?: boolean;
}

export interface AnnouncementResult {
  recipients: number;
  sent: number;
  failed: number;
  email_sent: number;
  telegram_sent: number;
}

/**
 * Sends the announcement to every active account. Email and the in-app
 * notification are always attempted; Telegram only for linked accounts.
 */
export async function sendCourseAnnouncement(
  courseId: number,
  options: SendOptions = {},
): Promise<AnnouncementResult> {
  const course = await loadCourse(courseId);
  if (course.announcement_sent_at && !options.force) {
    throw { status: 400, message: 'أُرسل الإعلان لهذا الكورس من قبل' };
  }

  const content = buildAnnouncementContent(course);
  const title = String(options.title || content.title).slice(0, 200);
  const body = String(options.body || content.body).slice(0, 8000);

  const usersResult = await sql(
    `SELECT id, email, telegram_chat_id, telegram_notifications
     FROM users
     WHERE is_active=1 AND role_id IN (1,2,3)`,
  );
  const users = usersResult.rows as any[];

  let emailSent = 0;
  let telegramSent = 0;
  let failed = 0;

  const emailEnabled = isEmailEnabled();
  const telegramEnabled = isTelegramEnabled();

  // Chunk the fan-out so a large user base does not open hundreds of sockets.
  const chunkSize = 20;
  for (let index = 0; index < users.length; index += chunkSize) {
    const chunk = users.slice(index, index + chunkSize);
    const tasks: Promise<void>[] = [];

    for (const user of chunk) {
      const userId = Number(user.id);
      // In-app notification is mandatory for every account.
      tasks.push(
        createNotification(userId, title, body, 'info', `/courses/${course.id}`).then(() => undefined),
      );

      const email = String(user.email || '').trim();
      if (emailEnabled && email) {
        tasks.push(
          sendGenericEmail(email, title, body).then((ok) => {
            if (ok) emailSent += 1;
            else failed += 1;
          }),
        );
      }

      const chatId = String(user.telegram_chat_id || '').trim();
      if (telegramEnabled && chatId && Number(user.telegram_notifications) !== 0) {
        tasks.push(
          sendGenericTelegram(chatId, `${title}\n\n${body}`).then((ok) => {
            if (ok) telegramSent += 1;
            else failed += 1;
          }),
        );
      }
    }

    const results = await Promise.allSettled(tasks);
    failed += results.filter((result) => result.status === 'rejected').length;
  }

  await sql(
    "UPDATE courses SET announcement_sent_at=datetime('now') WHERE id=?",
    course.id,
  );

  return {
    recipients: users.length,
    sent: users.length,
    failed,
    email_sent: emailSent,
    telegram_sent: telegramSent,
  };
}

/**
 * Sends the announcement when automatic sending is enabled and the course has
 * just been published. Never throws: publishing must not fail because of it.
 */
export async function maybeAutoAnnounceCourse(courseId: number): Promise<boolean> {
  try {
    const settings = await getAnnouncementSettings();
    if (!settings.autoEnabled) return false;
    const course = await loadCourse(courseId);
    if (course.announcement_sent_at) return false;
    await sendCourseAnnouncement(courseId);
    return true;
  } catch (error: any) {
    console.error('[Announcement] Auto-send failed:', error?.message || error);
    return false;
  }
}
