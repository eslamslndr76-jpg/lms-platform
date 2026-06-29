import { execute } from './turso-http';
import type { ResultSet } from '@libsql/client';

export function escape(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

export async function sql(query: string, ...args: unknown[]): Promise<ResultSet> {
  let idx = 0;
  const filled = query.replace(/\?/g, () => escape(args[idx++]));
  const result = await execute(filled);
  return {
    rows: result.rows,
    columns: result.columns,
    rowsAffected: result.affectedRowCount || 0,
    lastInsertRowid: result.lastInsertRowid ? { toString: () => result.lastInsertRowid! } : undefined,
    columnTypes: [],
    toJSON: () => ({ rows: result.rows, columns: result.columns }),
  } as unknown as ResultSet;
}

export async function sqlOne(query: string, ...args: unknown[]) {
  const result = await sql(query, ...args);
  return result.rows[0] || null;
}
