import crypto from 'crypto';
import { sql } from '../db/helpers';
import { execute } from '../db/turso-http';
import { sendNotification } from './externalNotificationService';

/**
 * Single issuance path for every certificate the system produces: manual from
 * the admin panel, auto on group completion, the AI tool, and auto after a
 * survey submission. One lazy status-column migration, one duplicate rule, one
 * serial format and one notification everywhere. Nothing here links a
 * certificate to a survey response, so anonymous surveys stay anonymous.
 */

export interface IssuedCertificate {
  id: number;
  serial_id: string;
}

export interface IssueCertificateResult {
  issued: boolean;
  /** Present only when issued === true. */
  certificate?: IssuedCertificate;
  /** Why nothing was issued: 'duplicate' or a failure message. */
  reason?: string;
}

// Lazy migration: ensure certificate status columns exist before any write.
let certColumnsEnsured = false;
export async function ensureCertColumns() {
  if (certColumnsEnsured) return;
  const cols = [
    "ALTER TABLE certificates ADD COLUMN status TEXT DEFAULT 'active'",
    'ALTER TABLE certificates ADD COLUMN revoked_at DATETIME',
    'ALTER TABLE certificates ADD COLUMN revoke_reason TEXT',
  ];
  for (const stmt of cols) {
    try { await execute(stmt); } catch { /* column may already exist */ }
  }
  certColumnsEnsured = true;
}

export async function certHasStatusColumn(): Promise<boolean> {
  try {
    const r = await sql('SELECT status FROM certificates LIMIT 1');
    return !!r;
  } catch {
    return false;
  }
}

/**
 * Issue a certificate for (student, course) unless one is already active.
 * Never throws: failures are logged with the student/course and returned as
 * issued=false, so callers (survey submission, group completion) can never be
 * broken by issuance problems.
 */
export async function issueCertificate(
  userId: number,
  courseId: number,
  options: { notify?: boolean } = {},
): Promise<IssueCertificateResult> {
  const { notify = true } = options;
  try {
    await ensureCertColumns();
    const hasCol = await certHasStatusColumn();

    let existing;
    if (hasCol) {
      existing = await sql(
        "SELECT id FROM certificates WHERE user_id=? AND course_id=? AND status='active'",
        userId, courseId,
      );
    } else {
      existing = await sql('SELECT id FROM certificates WHERE user_id=? AND course_id=?', userId, courseId);
    }
    if (existing.rows.length > 0) {
      return { issued: false, reason: 'duplicate' };
    }

    const serialId = crypto.randomBytes(8).toString('hex').toUpperCase();
    let result;
    if (hasCol) {
      result = await sql(
        "INSERT INTO certificates (user_id, course_id, serial_id, status) VALUES (?,?,?,?)",
        userId, courseId, serialId, 'active',
      );
    } else {
      result = await sql(
        'INSERT INTO certificates (user_id, course_id, serial_id) VALUES (?,?,?)',
        userId, courseId, serialId,
      );
    }
    const certificate: IssuedCertificate = { id: Number(result.lastInsertRowid), serial_id: serialId };

    const courseData = await sql('SELECT title_ar FROM courses WHERE id=?', courseId);
    const courseTitle = courseData.rows.length > 0 ? (courseData.rows[0] as any).title_ar : '';

    if (notify) {
      await sendNotification(userId, 'certificate_issued', { courseTitle, serialId })
        .catch((e: any) => console.error('[Notify] certificate_issued failed:', e?.message || e));
    }

    console.log(`[Certificate] Issued ${serialId} for student ${userId} in course ${courseId}`);
    return { issued: true, certificate };
  } catch (err: any) {
    console.error(`[Certificate] Issue failed (user=${userId}, course=${courseId}):`, err?.message || err);
    return { issued: false, reason: err?.message || 'issue failed' };
  }
}

/**
 * Auto-issuance right after a survey submission: only when the student has a
 * paid order for the course — no attendance minimum (matches the manual
 * issuance policy). Returns the issued certificate, or null when the student
 * has no paid order or nothing was issued (duplicate/failure, already logged).
 */
export async function issueCertificateIfPaid(
  userId: number,
  courseId: number,
): Promise<IssuedCertificate | null> {
  try {
    const paidOrder = await sql(
      `SELECT o.id FROM orders o
       JOIN order_items oi ON oi.order_id = o.id AND oi.course_id = ?
       WHERE o.user_id = ? AND o.status = 'paid'
       LIMIT 1`,
      courseId, userId,
    );
    if (paidOrder.rows.length === 0) {
      console.log(`[Certificate] Auto-issue skipped for student ${userId} in course ${courseId}: no paid order`);
      return null;
    }
    const result = await issueCertificate(userId, courseId);
    return result.issued ? result.certificate! : null;
  } catch (err: any) {
    console.error(`[Certificate] Auto-issue failed (user=${userId}, course=${courseId}):`, err?.message || err);
    return null;
  }
}
