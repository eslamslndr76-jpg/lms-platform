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
    "ALTER TABLE groups ADD COLUMN is_complete INTEGER DEFAULT 0",
    "ALTER TABLE groups ADD COLUMN max_students INTEGER",
    "ALTER TABLE groups ADD COLUMN instructor_name TEXT DEFAULT ''",
    "ALTER TABLE groups ADD COLUMN location TEXT DEFAULT ''",
    "ALTER TABLE courses ADD COLUMN featured INTEGER DEFAULT 0",
    "ALTER TABLE courses ADD COLUMN enable_direct_purchase INTEGER DEFAULT 1",
  ];
  for (const m of migrations) {
    try { await execute(m); } catch { /* column may already exist */ }
  }

  await seed();
  console.log('Database initialized');
}

export { execute, executeMultiple };
