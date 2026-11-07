import { execute, executeMultiple } from './turso-http';
import { SCHEMA_SQL } from './schema';
import { seed } from './seed';

export async function initializeDatabase() {
  await executeMultiple(SCHEMA_SQL);

  const migrations = [
    "ALTER TABLE users ADD COLUMN avatar TEXT",
    "ALTER TABLE courses ADD COLUMN image_url TEXT",
    "ALTER TABLE courses ADD COLUMN lecture_count INTEGER DEFAULT 0",
    "ALTER TABLE courses ADD COLUMN lecture_duration REAL DEFAULT 0",
    "ALTER TABLE courses ADD COLUMN instructor TEXT DEFAULT ''",
    "ALTER TABLE courses ADD COLUMN course_mode TEXT DEFAULT 'online'",
    "ALTER TABLE courses ADD COLUMN objectives TEXT DEFAULT '[]'",
    "ALTER TABLE courses ADD COLUMN daily_content TEXT DEFAULT '[]'",
    "ALTER TABLE courses ADD COLUMN introduction TEXT DEFAULT ''",
    "ALTER TABLE courses ADD COLUMN target_audience TEXT DEFAULT ''",
    "ALTER TABLE courses ADD COLUMN proposal_id INTEGER",
    "ALTER TABLE courses ADD COLUMN announcement_sent_at DATETIME",
    "ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'",
    "ALTER TABLE orders ADD COLUMN notes_student TEXT",
    "ALTER TABLE orders ADD COLUMN notes_team TEXT",
    "ALTER TABLE orders ADD COLUMN verified_by INTEGER",
    "ALTER TABLE orders ADD COLUMN verified_at DATETIME",
    "ALTER TABLE groups ADD COLUMN is_complete INTEGER DEFAULT 0",
    "ALTER TABLE groups ADD COLUMN max_students INTEGER",
    "ALTER TABLE groups ADD COLUMN instructor_name TEXT DEFAULT ''",
    "ALTER TABLE groups ADD COLUMN instructor_user_id INTEGER",
    "ALTER TABLE groups ADD COLUMN instructor_eval_opened_at DATETIME",
    "ALTER TABLE groups ADD COLUMN activity_type TEXT DEFAULT ''",
    "ALTER TABLE groups ADD COLUMN report_notes TEXT DEFAULT ''",
    "ALTER TABLE groups ADD COLUMN report_recommendations TEXT DEFAULT ''",
    "ALTER TABLE groups ADD COLUMN location TEXT DEFAULT ''",
    "CREATE TABLE IF NOT EXISTS places (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, capacity INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "ALTER TABLE groups ADD COLUMN place_id INTEGER",
    "ALTER TABLE courses ADD COLUMN featured INTEGER DEFAULT 0",
    "ALTER TABLE courses ADD COLUMN enable_direct_purchase INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN national_id TEXT",
    "ALTER TABLE users ADD COLUMN birth_date TEXT",
    "ALTER TABLE users ADD COLUMN gender TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN governorate TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN is_enrolled INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN university_name TEXT",
    "ALTER TABLE users ADD COLUMN university_code TEXT",
    "ALTER TABLE orders ADD COLUMN sender_phone TEXT",
    "ALTER TABLE courses ADD COLUMN auto_assign INTEGER DEFAULT 1",
    "UPDATE courses SET auto_assign=1 WHERE auto_assign IS NULL OR auto_assign=0",
    "ALTER TABLE courses ADD COLUMN prevent_overlap INTEGER DEFAULT 1",
    "ALTER TABLE groups ADD COLUMN status TEXT DEFAULT 'pending'",
    "ALTER TABLE lectures ADD COLUMN zoom_link TEXT DEFAULT ''",
    "ALTER TABLE lectures ADD COLUMN location TEXT DEFAULT ''",
    "ALTER TABLE lectures ADD COLUMN attendance_active INTEGER DEFAULT 0",
    "ALTER TABLE lectures ADD COLUMN attendance_seed TEXT",
    "ALTER TABLE lectures ADD COLUMN attendance_started_at DATETIME",
    "ALTER TABLE lectures ADD COLUMN attendance_expires_at DATETIME",
    "CREATE TABLE IF NOT EXISTS lecture_attendance (id INTEGER PRIMARY KEY AUTOINCREMENT, lecture_id INTEGER NOT NULL, user_id INTEGER NOT NULL, attended INTEGER NOT NULL DEFAULT 0, attended_at DATETIME, FOREIGN KEY (lecture_id) REFERENCES lectures(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id), UNIQUE(lecture_id, user_id))",
    "CREATE TABLE IF NOT EXISTS group_student_history (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, user_id INTEGER NOT NULL, action TEXT NOT NULL, moved_by INTEGER, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE)",
    "ALTER TABLE lecture_attendance ADD COLUMN verification_method TEXT DEFAULT 'qr'",
    "ALTER TABLE lecture_attendance ADD COLUMN code_used TEXT",
    "ALTER TABLE lecture_attendance ADD COLUMN ip_address TEXT",
    "CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, title TEXT NOT NULL, message TEXT, type TEXT NOT NULL DEFAULT 'info', link TEXT, is_read INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    "ALTER TABLE courses ADD COLUMN enable_mobile_sticky_cta INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN phone_verified INTEGER DEFAULT 0",
    "ALTER TABLE users ADD COLUMN otp TEXT",
    "ALTER TABLE users ADD COLUMN otp_expires DATETIME",
    // Legacy whatsapp_logs table (kept for data migration)
    "CREATE TABLE IF NOT EXISTS whatsapp_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, phone TEXT NOT NULL, type TEXT NOT NULL, message TEXT, status TEXT NOT NULL DEFAULT 'sent', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    // OTP codes table
    "CREATE TABLE IF NOT EXISTS otp_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, identifier TEXT NOT NULL, code TEXT NOT NULL, purpose TEXT, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    // Telegram + Email notification columns
    // Per-user permission overrides (NULL = inherit the role) + login audit
    "ALTER TABLE users ADD COLUMN permissions TEXT",
    "ALTER TABLE users ADD COLUMN last_login DATETIME",
    "ALTER TABLE users ADD COLUMN telegram_chat_id TEXT",
    "ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1",
    "ALTER TABLE users ADD COLUMN telegram_notifications INTEGER DEFAULT 1",
    // Notification logs (replaces whatsapp_logs)
    "CREATE TABLE IF NOT EXISTS notification_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, channel TEXT NOT NULL, type TEXT NOT NULL, message TEXT, status TEXT NOT NULL DEFAULT 'sent', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
    // Certificate status (active/revoked)
    "ALTER TABLE certificates ADD COLUMN status TEXT DEFAULT 'active'",
    "ALTER TABLE certificates ADD COLUMN revoked_at DATETIME",
    "ALTER TABLE certificates ADD COLUMN revoke_reason TEXT",
    // Fix phones missing leading 0: 10 digits starting with 1 → prepend 0
    "UPDATE users SET phone = '0' || phone WHERE phone NOT LIKE '0%' AND phone NOT LIKE '20%' AND LENGTH(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', '')) = 10 AND REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '(', '') LIKE '1%'",
    // Fix phones with +20 prefix: +201XXXXXXXXX → 01XXXXXXXXX
    "UPDATE users SET phone = '0' || SUBSTR(phone, 4) WHERE phone LIKE '+201%'",
    // Fix phones with 20 prefix (no +): 201XXXXXXXXX → 01XXXXXXXXX
    "UPDATE users SET phone = '0' || SUBSTR(phone, 3) WHERE phone LIKE '201%' AND phone NOT LIKE '0%'",
    // Ensure all users have notification preferences enabled by default
    "UPDATE users SET email_notifications = 1 WHERE email_notifications IS NULL OR email_notifications = 0",
    "UPDATE users SET telegram_notifications = 1 WHERE telegram_notifications IS NULL OR telegram_notifications = 0",
    // Fast lookup for the in-app notification bell (user feed ordered by date)
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)",
    // In-app notifications are retained for 30 days only
    "DELETE FROM notifications WHERE created_at < datetime('now','-30 days')",
    // Official manual group completion (edit-plan.md §4.2). Completion is no
    // longer derived from the lectures; it is an explicit admin action.
    "ALTER TABLE groups ADD COLUMN completed_at DATETIME",
    "ALTER TABLE groups ADD COLUMN completed_by INTEGER",
    "CREATE INDEX IF NOT EXISTS idx_groups_status ON groups(status)",
    // Backfill groups that were auto-completed before this change so their
    // completion timestamp reflects the last completed lecture.
    "UPDATE groups SET completed_at = COALESCE((SELECT MAX(l.completed_at) FROM lectures l WHERE l.group_id = groups.id), CURRENT_TIMESTAMP) WHERE is_complete = 1 AND completed_at IS NULL",
    // Post-course student survey (edit-plan.md §4.4)
    "ALTER TABLE groups ADD COLUMN survey_closes_at DATETIME",
    "ALTER TABLE groups ADD COLUMN survey_reminder1_at DATETIME",
    "ALTER TABLE groups ADD COLUMN survey_reminder2_at DATETIME",
    "CREATE TABLE IF NOT EXISTS group_surveys (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, user_id INTEGER NOT NULL, is_anonymous INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', answers TEXT NOT NULL DEFAULT '{}', current_step INTEGER NOT NULL DEFAULT 0, started_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, submitted_at DATETIME, UNIQUE(group_id, user_id), FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id))",
    "CREATE INDEX IF NOT EXISTS idx_group_surveys_group ON group_surveys(group_id)",
    "CREATE INDEX IF NOT EXISTS idx_group_surveys_user ON group_surveys(user_id)",
    // Give groups completed before the survey existed a 30-day window.
    "UPDATE groups SET survey_closes_at = datetime(COALESCE(completed_at, CURRENT_TIMESTAMP), '+30 days') WHERE status = 'completed' AND survey_closes_at IS NULL",
    // FCM push notification token for Flutter mobile app
    "ALTER TABLE users ADD COLUMN fcm_token TEXT",
  ];
  for (const m of migrations) {
    try { await execute(m); } catch { /* column may already exist */ }
  }

  await seed();
  console.log('Database initialized');
}

export { execute, executeMultiple };
