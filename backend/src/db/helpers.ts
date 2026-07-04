import { execute } from './turso-http';
import type { ResultSet } from '@libsql/client';

export function escape(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  const s = String(val);
  if (/^\d+$/.test(s)) return s;
  return "'" + s.replace(/'/g, "''") + "'";
}

export async function sql(query: string, ...args: unknown[]): Promise<ResultSet> {
  let idx = 0;
  const filled = query.replace(/\?/g, () => escape(args[idx++]));
  const result = await execute(filled);
  return {
    rows: normalizeRows(result.rows),
    columns: result.columns,
    rowsAffected: result.affectedRowCount || 0,
    lastInsertRowid: result.lastInsertRowid ? { toString: () => result.lastInsertRowid! } : undefined,
    columnTypes: [],
    toJSON: () => ({ rows: normalizeRows(result.rows), columns: result.columns }),
  } as unknown as ResultSet;
}

export function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const v = (row as any)[key];
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && 'type' in v && Object.keys(v).length === 1) {
      out[key] = null;
    } else {
      out[key] = v;
    }
  }
  return out;
}

export function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(r => normalizeRow(r));
}

export async function sqlOne(query: string, ...args: unknown[]) {
  const result = await sql(query, ...args);
  return result.rows[0] || null;
}
