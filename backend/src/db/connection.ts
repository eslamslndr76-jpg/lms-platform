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
    "ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'cash'",
    "ALTER TABLE orders ADD COLUMN notes_student TEXT",
    "ALTER TABLE orders ADD COLUMN notes_team TEXT",
    "ALTER TABLE orders ADD COLUMN verified_by INTEGER",
    "ALTER TABLE orders ADD COLUMN verified_at DATETIME",
    "ALTER TABLE groups ADD COLUMN is_complete INTEGER DEFAULT 0",
    "ALTER TABLE groups ADD COLUMN max_students INTEGER",
    "ALTER TABLE groups ADD COLUMN instructor_name TEXT DEFAULT ''",
    "ALTER TABLE groups ADD COLUMN location TEXT DEFAULT ''",
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
  ];
  for (const m of migrations) {
    try { await execute(m); } catch { /* column may already exist */ }
  }

  await seed();
  console.log('Database initialized');
}

export { execute, executeMultiple };
