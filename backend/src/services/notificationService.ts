import { sql } from '../db/helpers';

/** In-app notifications are kept (and shown) for the last 30 days only. */
const RETENTION_DAYS = 30;
const RETENTION_CUTOFF = `datetime('now','-${RETENTION_DAYS} days')`;

let lastCleanupAt = 0;

/**
 * Physically removes notifications older than the retention window.
 * Runs at most once per hour unless `force` is set (used on boot).
 */
export async function cleanupOldNotifications(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastCleanupAt < 60 * 60 * 1000) return 0;
  try {
    const result = await sql(`DELETE FROM notifications WHERE created_at < ${RETENTION_CUTOFF}`);
    lastCleanupAt = now;
    return result.rowsAffected;
  } catch {
    return 0;
  }
}

export async function createNotification(
  userId: number,
  title: string,
  message?: string,
  type: 'info' | 'success' | 'warning' = 'info',
  link?: string,
): Promise<number> {
  const result = await sql(
    'INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)',
    userId, title, message || null, type, link || null,
  );
  // Fire-and-forget: keep the table tidy without delaying the notification.
  void cleanupOldNotifications();
  return Number(result.lastInsertRowid);
}

export async function createBulkNotification(
  userIds: number[],
  title: string,
  message?: string,
  type: 'info' | 'success' | 'warning' = 'info',
  link?: string,
): Promise<void> {
  for (const uid of userIds) {
    await createNotification(uid, title, message, type, link);
  }
}

export async function notifyGroupStudents(
  groupId: number,
  title: string,
  message?: string,
  type: 'info' | 'success' | 'warning' = 'info',
  link?: string,
): Promise<void> {
  const students = await sql(
    'SELECT user_id FROM group_students WHERE group_id=?',
    groupId,
  );
  for (const row of students.rows) {
    await createNotification(Number((row as any).user_id), title, message, type, link);
  }
}

export async function getMyNotifications(userId: number, limit: number = 20, offset: number = 0): Promise<any[]> {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const result = await sql(
    `SELECT * FROM notifications
     WHERE user_id=? AND created_at >= ${RETENTION_CUTOFF}
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
    userId, safeLimit, safeOffset,
  );
  return result.rows;
}

export async function getUnreadCount(userId: number): Promise<number> {
  const result = await sql(
    `SELECT COUNT(*) as cnt FROM notifications
     WHERE user_id=? AND is_read=0 AND created_at >= ${RETENTION_CUTOFF}`,
    userId,
  );
  return Number(result.rows[0].cnt);
}

export async function markAsRead(notificationId: number, userId: number): Promise<void> {
  await sql(
    'UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?',
    notificationId, userId,
  );
}

export async function markAllAsRead(userId: number): Promise<void> {
  await sql('UPDATE notifications SET is_read=1 WHERE user_id=?', userId);
}
