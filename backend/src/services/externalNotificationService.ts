import { sql } from '../db/helpers';
import { sendFcmToToken, isFcmEnabled } from './fcmService';
import { createNotification } from './notificationService';
import { sendEmailOTP, sendGenericEmail, isEmailEnabled } from './emailService';
import { sendTelegramOTP, sendGenericTelegram, isTelegramEnabled } from './telegramService';
import { getFrontendUrl, OTP_TTL_MINUTES, OTP_LENGTH } from '../config/notification';
import crypto from 'crypto';

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export type NotificationType =
  | 'account_created'
  | 'password_reset_done'
  | 'order_created'
  | 'order_paid'
  | 'order_cancelled'
  | 'assigned_to_group'
  | 'moved_to_group'
  | 'removed_from_group'
  | 'lecture_added'
  | 'lecture_completed'
  | 'attendance_opened'
  | 'attendance_confirmed'
  | 'certificate_issued'
  | 'certificate_revoked'
  | 'certificate_restored'
  | 'group_completed'
  | 'survey_opened'
  | 'survey_reminder'
  | 'instructor_eval_opened'
  | 'instructor_eval_submitted'
  | 'proposal_reviewed';

interface OrderData { courseTitle: string; amount?: number; orderId?: number; }
interface GroupAssignedData { courseTitle: string; groupName: string; instructor?: string; location?: string; startDate?: string; endDate?: string; }
interface GroupMovedData { courseTitle: string; oldGroupName: string; newGroupName: string; }
interface GroupRemovedData { courseTitle: string; groupName: string; }
interface LectureAddedData { courseTitle: string; groupName: string; topic: string; date?: string; timeFrom?: string; timeTo?: string; location?: string; zoomLink?: string; }
interface LectureCompletedData { courseTitle: string; groupName: string; topic: string; }
interface AttendanceOpenedData { courseTitle: string; groupName: string; topic: string; lectureId: number; code: string; }
interface AttendanceConfirmedData { courseTitle: string; groupName: string; topic: string; }
interface CertificateIssuedData { courseTitle: string; serialId: string; }
interface ProposalReviewedData { courseTitle: string; statusLabel: string; note?: string; proposalId: number; }

const FRONTEND_URL = getFrontendUrl();

// ═══════════════════════════════════════════════
// Message Builder (Arabic — same as before)
// ═══════════════════════════════════════════════

function buildMessage(type: NotificationType, data: any): string {
  const brand = 'وحدة التدريب و التطوير\nنحو تعليم أفضل';
  const sep = '\n━━━━━━━━━━━━━━━━━';

  switch (type) {
    case 'account_created':
      return `🎉 أهلاً وسهلاً ${data.name}!\n\nتم إنشاء حسابك بنجاح في ${FRONTEND_URL}\nيمكنك الآن تصفح الدورات والتسجيل فيها.${sep}\n${brand}`;

    case 'password_reset_done':
      return `✅ تم إعادة تعيين كلمة المرور بنجاح!\n\nيمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.${sep}\n${brand}`;

    case 'order_created':
      return `📋 طلب تسجيل جديد\n\nالدورة: ${data.courseTitle}\nالمبلغ: ${data.amount ? data.amount + ' ج.م' : '—'}\nرقم الطلب: #${data.orderId || '—'}\n\n⏳ في انتظار المراجعة والتأكيد${sep}\n${brand}`;

    case 'order_paid':
      return `✅ تم تأكيد الدفع!\n\nالدورة: ${data.courseTitle}\n${data.amount ? 'المبلغ: ' + data.amount + ' ج.م\n' : ''}تم إضافتك في المجموعة. تابع دوراتك من:\n${FRONTEND_URL}/my-courses${sep}\n${brand}`;

    case 'order_cancelled':
      return `❌ تم إلغاء طلب التسجيل\n\nالدورة: ${data.courseTitle}\n\nيمكنك التواصل مع الإدارة لمزيد من التفاصيل.${sep}\n${brand}`;

    case 'assigned_to_group':
      return `👥 تعيين في مجموعة جديدة\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\n${data.instructor ? 'المدرب: ' + data.instructor + '\n' : ''}${data.location ? 'المكان: ' + data.location + '\n' : ''}${data.startDate ? 'من: ' + data.startDate : ''}${data.endDate ? ' إلى: ' + data.endDate : ''}\n\nتابع جدولك من:\n${FRONTEND_URL}/my-courses${sep}\n${brand}`;

    case 'moved_to_group':
      return `🔄 نقل إلى مجموعة أخرى\n\nالدورة: ${data.courseTitle}\nمن: ${data.oldGroupName}\nإلى: ${data.newGroupName}${sep}\n${brand}`;

    case 'removed_from_group':
      return `🚪 إزالة من مجموعة\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\n\nتواصل مع الإدارة إذا كنت تريد الاستفسار.${sep}\n${brand}`;

    case 'lecture_added':
      return `📚 محاضرة جديدة مضافة\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\nالموضوع: ${data.topic}\n${data.date ? 'التاريخ: ' + data.date + '\n' : ''}${data.timeFrom ? 'الوقت: ' + data.timeFrom : ''}${data.timeTo ? ' - ' + data.timeTo : ''}\n${data.location ? 'المكان: ' + data.location + '\n' : ''}${data.zoomLink ? 'زووم: ' + data.zoomLink : ''}${sep}\n${brand}`;

    case 'lecture_completed':
      return `✅ اكتملت المحاضرة\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\nالموضوع: ${data.topic}${sep}\n${brand}`;

    case 'attendance_opened':
      return `📝 تم فتح سجل الحضور\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\nالموضوع: ${data.topic}\n\n⚠️ يجب تسجيل حضورك الآن!\nافتح الرابط وامسح كود الحضور بالكاميرا أو أدخله يدوياً:\n${FRONTEND_URL}/attendance/${data.lectureId}${sep}\n${brand}`;

    case 'attendance_confirmed':
      return `✅ تم تسجيل حضورك بنجاح!\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\nالموضوع: ${data.topic}${sep}\n${brand}`;

    case 'certificate_issued':
      return `🏆 شهادة جديدة!\n\nتم إصدار شهادتك في دورة: ${data.courseTitle}\nرقم الشهادة: ${data.serialId}\n\nيمكنك تحميلها من حسابك:\n${FRONTEND_URL}/dashboard${sep}\n${brand}`;

    case 'certificate_revoked':
      return `🚫 تم سحب شهادتك\n\nتم سحب شهادتك في دورة: ${data.courseTitle}\n\nيرجى التواصل مع الإدارة لمزيد من التفاصيل.\n${FRONTEND_URL}/dashboard${sep}\n${brand}`;

    case 'certificate_restored':
      return `✅ تم استعادة شهادتك!\n\nتم إعادة شهادتك في دورة: ${data.courseTitle}\nرقم الشهادة: ${data.serialId}\n\nيمكنك تحميلها من حسابك:\n${FRONTEND_URL}/dashboard${sep}\n${brand}`;

    case 'group_completed':
      return `🎓 انتهت مجموعتك!\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\n\nشكراً لمشاركتك معنا. يمكنك مراجعة دوراتك وشهاداتك من:\n${FRONTEND_URL}/my-courses${sep}\n${brand}`;

    case 'survey_opened':
      return `⭐ قيّم دورتك\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\n\nرأيك يساعدنا على تحسين البرامج القادمة، ويستغرق الاستبيان نحو دقيقتين فقط:\n${FRONTEND_URL}/survey/${data.groupId}${sep}\n${brand}`;

    case 'survey_reminder':
      return `⏰ تذكير: قيّم دورتك\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\n\nلم نستلم إجابتك بعد — يتبقى وقت محدود لإكمال الاستبيان:\n${FRONTEND_URL}/survey/${data.groupId}${sep}\n${brand}`;

    case 'instructor_eval_opened':
      return `📝 تقييم الطلاب متاح\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\n\nتم فتح تقييم طلاب المجموعة. يرجى إدخال درجات الطلاب من حساب المحاضر:\n${FRONTEND_URL}/instructor${sep}\n${brand}`;

    case 'instructor_eval_submitted':
      return `📋 اكتمل تقييم المحاضر للطلاب\n\nالدورة: ${data.courseTitle}\nالمجموعة: ${data.groupName}\nالمحاضر: ${data.instructorName}\n\nأُرسل تقييم الطلاب وهو متاح الآن في لوحة الإدارة.${sep}\n${brand}`;

    case 'proposal_reviewed':
      return `📝 تحديث على مقترحك\n\nمقترح الدورة: ${data.courseTitle}\nالحالة: ${data.statusLabel}${data.note ? `\nملاحظة الإدارة: ${data.note}` : ''}\n\nيمكنك مراجعة المقترح من:\n${FRONTEND_URL}/instructor/proposals/${data.proposalId}${sep}\n${brand}`;

    default:
      return `📢 إشعار جديد من وحدة التدريب و التطوير\n\n${brand}`;
  }
}

// ═══════════════════════════════════════════════
// User Lookup
// ═══════════════════════════════════════════════

interface UserData {
  phone: string | null;
  email: string | null;
  telegram_chat_id: string | null;
  name: string | null;
  email_notifications: number;
  telegram_notifications: number;
  fcm_token?: string | null;
}

async function getUserData(userId: number): Promise<UserData | null> {
  const result = await sql(
    `SELECT phone, email, telegram_chat_id, name, fcm_token,
            COALESCE(NULLIF(email_notifications, 0), 1) as email_notifications,
            COALESCE(NULLIF(telegram_notifications, 0), 1) as telegram_notifications
     FROM users WHERE id=?`,
    userId,
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0] as any;
  return {
    phone: r.phone || null,
    email: r.email || null,
    telegram_chat_id: r.telegram_chat_id || null,
    name: r.name || null,
    email_notifications: Number(r.email_notifications),
    telegram_notifications: Number(r.telegram_notifications),
    fcm_token: r.fcm_token || null,
  };
}

// ═══════════════════════════════════════════════
// Log
// ═══════════════════════════════════════════════

async function logMessage(userId: number | null, channel: string, type: string, message: string, status: string): Promise<void> {
  try {
    await sql(
      `INSERT INTO notification_logs (user_id, channel, type, message, status) VALUES (?,?,?,?,?)`,
      userId, channel, type, message.substring(0, 2000), status,
    );
  } catch (err: any) {
    console.error('Failed to log notification:', err.message);
  }
}

// ═══════════════════════════════════════════════
// Core Send
// ═══════════════════════════════════════════════

async function sendToUser(userId: number, type: NotificationType, data: any): Promise<void> {
  const user = await getUserData(userId);
  if (!user) {
    console.warn(`[Notify] User ${userId} not found, skipping`);
    return;
  }

  const message = buildMessage(type, data);
  const subject = getSubjectForType(type, data);
  const link = getLinkForType(type, data);
  const notifType = getCategoryForType(type);
  const shortSummary = getShortSummary(type, data);

  // Always create an in-app notification row for real-time and background app push sync
  try {
    await createNotification(userId, subject, shortSummary, notifType, link);
  } catch (notifErr: any) {
    console.error('[Notify] In-app notification creation failed:', notifErr.message);
  }

  const promises: Promise<any>[] = [];

  // FCM Push Notification (Flutter mobile app)
  if (isFcmEnabled() && user.fcm_token) {
    sendFcmToToken(
      user.fcm_token,
      subject,
      shortSummary,
      { link, type: notifType },
    ).catch(() => {});
  }

  // Email
  if (user.email && user.email_notifications && isEmailEnabled()) {
    const subject = getSubjectForType(type, data);
    promises.push(
      sendGenericEmail(user.email, subject, message)
        .then(ok => logMessage(userId, 'email', type, message, ok ? 'sent' : 'failed'))
        .catch(() => logMessage(userId, 'email', type, message, 'failed')),
    );
  }

  // Telegram
  if (user.telegram_chat_id && user.telegram_notifications && isTelegramEnabled()) {
    promises.push(
      sendGenericTelegram(user.telegram_chat_id, message)
        .then(ok => logMessage(userId, 'telegram', type, message, ok ? 'sent' : 'failed'))
        .catch(() => logMessage(userId, 'telegram', type, message, 'failed')),
    );
  }

  if (promises.length === 0) {
    console.warn(`[Notify] No channel available for user ${userId} (email: ${user.email}, telegram: ${user.telegram_chat_id})`);
    logMessage(userId, 'none', type, message, 'no_channel');
    return;
  }

  await Promise.allSettled(promises);
}


function getCategoryForType(type: NotificationType): 'info' | 'success' | 'warning' {
  switch (type) {
    case 'attendance_opened':
    case 'order_cancelled':
    case 'certificate_revoked':
    case 'removed_from_group':
      return 'warning';
    case 'order_paid':
    case 'attendance_confirmed':
    case 'certificate_issued':
    case 'certificate_restored':
      return 'success';
    default:
      return 'info';
  }
}

function getLinkForType(type: NotificationType, data: any): string {
  switch (type) {
    case 'attendance_opened':
      return `/attendance/${data.lectureId}?code=${data.code || ''}`;
    case 'certificate_issued':
    case 'certificate_restored':
      return '/certificates';
    case 'order_created':
    case 'order_cancelled':
      return '/orders';
    case 'survey_opened':
    case 'survey_reminder':
      return `/survey/${data.groupId}`;
    case 'instructor_eval_opened':
      return '/instructor';
    case 'proposal_reviewed':
      return `/instructor/proposals/${data.proposalId}`;
    default:
      return '/my-courses';
  }
}

function getShortSummary(type: NotificationType, data: any): string {
  switch (type) {
    case 'attendance_opened':
      return `تم فتح باب الحضور لمحاضرة: ${data.topic || ''} في دورة ${data.courseTitle || ''}. اضغط لتأكيد الحضور بالكود: ${data.code || ''}`;
    case 'attendance_confirmed':
      return `تم تسجيل حضورك بنجاح في محاضرة ${data.topic || ''}`;
    case 'lecture_added':
      return `محاضرة جديدة: ${data.topic || ''} في دورة ${data.courseTitle || ''} (${data.date || ''} ${data.timeFrom || ''})`;
    case 'order_paid':
      return `تم تأكيد اشتراكك في دورة ${data.courseTitle || ''}`;
    case 'certificate_issued':
      return `تهانينا! تم إصدار شهادتك في دورة ${data.courseTitle || ''}`;
    case 'assigned_to_group':
      return `تم إضافتك إلى مجموعة ${data.groupName || ''} في دورة ${data.courseTitle || ''}`;
    default:
      return buildMessage(type, data).split('\n')[0] || 'إشعار جديد';
  }
}

function getSubjectForType(type: NotificationType, data: any): string {
  switch (type) {
    case 'account_created': return '🎉 مرحباً بك في وحدة التدريب و التطوير';
    case 'password_reset_done': return '✅ تم إعادة تعيين كلمة المرور';
    case 'order_created': return '📋 طلب تسجيل جديد';
    case 'order_paid': return '✅ تم تأكيد الدفع';
    case 'order_cancelled': return '❌ تم إلغاء طلب التسجيل';
    case 'assigned_to_group': return '👥 تعيين في مجموعة جديدة';
    case 'moved_to_group': return '🔄 نقل إلى مجموعة أخرى';
    case 'removed_from_group': return '🚪 إزالة من مجموعة';
    case 'lecture_added': return '📚 محاضرة جديدة مضافة';
    case 'lecture_completed': return '✅ اكتملت المحاضرة';
    case 'attendance_opened': return '📝 يجب تسجيل حضورك الآن!';
    case 'attendance_confirmed': return '✅ تم تسجيل حضورك';
    case 'certificate_issued': return '🏆 شهادة جديدة';
    case 'certificate_revoked': return '🚫 تم سحب شهادتك';
    case 'certificate_restored': return '✅ تم استعادة شهادتك';
    case 'group_completed': return '🎓 انتهت مجموعتك';
    case 'survey_opened': return '⭐ قيّم دورتك';
    case 'survey_reminder': return '⏰ تذكير: قيّم دورتك';
    case 'instructor_eval_opened': return '📝 تقييم الطلاب متاح';
    case 'instructor_eval_submitted': return '📋 اكتمل تقييم المحاضر للطلاب';
    case 'proposal_reviewed': return '📝 تحديث على مقترحك';
    default: return '📢 إشعار من وحدة التدريب و التطوير';
  }
}

// ═══════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════

export async function sendNotification(userId: number, type: NotificationType, data: any): Promise<void> {
  await sendToUser(userId, type, data);
}

export async function sendBulkNotifications(userIds: number[], type: NotificationType, data: any): Promise<void> {
  await Promise.allSettled(userIds.map(uid => sendToUser(uid, type, data)));
}

export async function notifyGroupStudents(groupId: number, type: NotificationType, data: any): Promise<void> {
  const students = await sql('SELECT user_id FROM group_students WHERE group_id=?', groupId);
  const userIds = students.rows.map((r: any) => Number(r.user_id));
  if (userIds.length > 0) {
    await sendBulkNotifications(userIds, type, data);
  }
}

// ═══════════════════════════════════════════════
// OTP Functions
// ═══════════════════════════════════════════════

function generateOtp(): string {
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

export async function sendOTP(identifier: string, purpose: string = 'verification'): Promise<{ success: boolean; error?: string }> {
  // identifier = phone or email
  const isEmail = identifier.includes('@');

  // Rate limit: 1 OTP per 60 seconds
  const recentOtp = await sql(
    'SELECT created_at FROM otp_codes WHERE identifier=? ORDER BY created_at DESC LIMIT 1',
    identifier,
  );
  if (recentOtp.rows.length > 0) {
    const last = new Date((recentOtp.rows[0] as any).created_at).getTime();
    if (Date.now() - last < 60000) {
      return { success: false, error: 'تم إرسال رمز مؤخراً. انتظر دقيقة ثم حاول مرة أخرى.' };
    }
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  // Store OTP
  await sql(
    'INSERT INTO otp_codes (identifier, code, purpose, expires_at) VALUES (?,?,?,?)',
    identifier, otp, purpose, expiresAt,
  );

  // Send via all available channels
  let sent = false;

  if (isEmail && isEmailEnabled()) {
    const emailResult = await sendEmailOTP(identifier, otp, purpose);
    if (emailResult) sent = true;
  }

  if (!isEmail) {
    // Phone number — look up user by phone for telegram
    const user = await sql('SELECT telegram_chat_id, email FROM users WHERE phone=?', identifier);
    if (user.rows.length > 0) {
      const row = user.rows[0] as any;

      // Try Telegram
      if (row.telegram_chat_id && isTelegramEnabled()) {
        const tgResult = await sendTelegramOTP(row.telegram_chat_id, otp, purpose);
        if (tgResult) sent = true;
      }

      // Try email as fallback
      if (row.email && isEmailEnabled()) {
        const emailResult = await sendEmailOTP(row.email, otp, purpose);
        if (emailResult) sent = true;
      }
    }
  }

  if (!sent && !isEmail) {
    return { success: false, error: 'لا توجد قناة إشعارات متاحة. تأكد من ربط تيليجرام أو إدخال البريد الإلكتروني.' };
  }

  if (!sent && isEmail) {
    return { success: false, error: 'فشل إرسال البريد الإلكتروني. تأكد من صحة البريد.' };
  }

  return { success: true };
}

export async function verifyOTP(identifier: string, code: string): Promise<{ success: boolean; error?: string }> {
  const result = await sql(
    "SELECT id FROM otp_codes WHERE identifier=? AND code=? AND purpose IS NOT NULL AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
    identifier, code,
  );

  if (result.rows.length === 0) {
    return { success: false, error: 'الرمز غير صحيح أو منتهي الصلاحية' };
  }

  // Delete used OTP
  await sql('DELETE FROM otp_codes WHERE id=?', (result.rows[0] as any).id);

  return { success: true };
}

export async function resetPassword(phone: string, newPassword: string): Promise<void> {
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.hash(newPassword, 10);
  await sql('UPDATE users SET password=? WHERE phone=?', hash, phone);
}

export async function markPhoneVerified(phone: string): Promise<void> {
  await sql('UPDATE users SET phone_verified=1 WHERE phone=?', phone);
}

export async function broadcastAnnouncement(
  title: string,
  message: string,
  link?: string,
  type: 'info' | 'success' | 'warning' = 'info',
  targetRole: number = 3,
): Promise<{ count: number }> {
  const users = await sql(
    'SELECT id, email, telegram_chat_id, fcm_token, COALESCE(NULLIF(email_notifications, 0), 1) as email_notifications, COALESCE(NULLIF(telegram_notifications, 0), 1) as telegram_notifications FROM users WHERE role_id=?',
    targetRole,
  );
  for (const row of users.rows as any[]) {
    const uid = Number(row.id);
    await createNotification(uid, title, message, type, link || '/dashboard').catch(() => {});
    if (isFcmEnabled() && row.fcm_token) {
      sendFcmToToken(row.fcm_token, title, message, { link: link || '/dashboard', type }).catch(() => {});
    }
    if (row.email && Number(row.email_notifications) && isEmailEnabled()) {
      sendGenericEmail(row.email, title, `${message}\n\n${link ? FRONTEND_URL + link : FRONTEND_URL}`).catch(() => {});
    }
    if (row.telegram_chat_id && Number(row.telegram_notifications) && isTelegramEnabled()) {
      sendGenericTelegram(row.telegram_chat_id, `📢 <b>${title}</b>\n\n${message}\n\n${link ? FRONTEND_URL + link : FRONTEND_URL}`).catch(() => {});
    }
  }
  return { count: users.rows.length };
}
