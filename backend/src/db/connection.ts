import { execute, executeMultiple } from './turso-http';
import { SCHEMA_SQL } from './schema';
import { seed } from './seed';

export async function initializeDatabase() {
  await executeMultiple(SCHEMA_SQL);

  const migrations = [
    "ALTER TABLE users ADD COLUMN avatar TEXT",
    "ALTER TABLE courses ADD COLUMN image_url TEXT",
    "ALTER TABLE courses ADD COLUMN lecture_count INTEGER DEFAULT 0",
    "ALTER TABLE courses ADD COLUMN total_hours REAL DEFAULT 0",
    "ALTER TABLE courses ADD COLUMN instructor TEXT DEFAULT ''",
  ];
  for (const m of migrations) {
    try { await execute(m); } catch { /* column may already exist */ }
  }

  await seed();
  console.log('Database initialized');
}

export { execute, executeMultiple };
