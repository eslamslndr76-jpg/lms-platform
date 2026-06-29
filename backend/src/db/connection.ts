import { execute, executeMultiple } from './turso-http';
import { SCHEMA_SQL } from './schema';
import { seed } from './seed';

export async function initializeDatabase() {
  await executeMultiple(SCHEMA_SQL);
  await seed();
  console.log('Database initialized');
}

export { execute, executeMultiple };
