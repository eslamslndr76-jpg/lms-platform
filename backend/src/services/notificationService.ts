import { sql } from '../db/helpers';

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

export async function getMyNotifications(userId: number, limit: number = 20): Promise<any[]> {
  const result = await sql(
    'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT ?',
    userId, limit,
  );
  return result.rows;
}

export async function getUnreadCount(userId: number): Promise<number> {
  const result = await sql(
    'SELECT COUNT(*) as cnt FROM notifications WHERE user_id=? AND is_read=0',
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
