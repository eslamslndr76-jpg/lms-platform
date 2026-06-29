import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL || 'file:./data.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

let db: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!db) {
    db = createClient({ url, authToken });
  }
  return db;
}

export async function initializeDatabase() {
  const { getDb } = await import('./connection');
  const { SCHEMA_SQL } = await import('./schema');
  const { seed } = await import('./seed');
  const client = getDb();
  await client.executeMultiple(SCHEMA_SQL);
  await seed();
  console.log('Database initialized');
}
