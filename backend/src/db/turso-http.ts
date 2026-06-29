const TURSO_URL = (process.env.TURSO_DATABASE_URL || 'file:./data.db').replace('libsql://', 'https://');
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

interface QueryResult {
  rows: any[];
  columns: { name: string; decltype: string | null }[];
  lastInsertRowid?: string | null;
  affectedRowCount?: number;
}

export async function execute(sql: string): Promise<QueryResult> {
  if (TURSO_URL.startsWith('file:')) {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: TURSO_URL });
    const result = await client.execute(sql);
    return {
      rows: result.rows,
      columns: result.columns.map(c => ({ name: c.name, decltype: c.decltype as string | null })),
      lastInsertRowid: result.lastInsertRowid?.toString(),
      affectedRowCount: result.rowsAffected,
    };
  }
  const r = await fetch(TURSO_URL + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql } }] }),
  });
  const d: any = await r.json();
  const result = d.results?.[0];
  if (result?.type === 'error') throw new Error(result.error?.message || 'Turso error');
  const resp = result?.response?.result;
  if (!resp) throw new Error('Unexpected Turso response');
  return {
    rows: resp.rows?.map((row: any[]) => {
      const obj: any = {};
      resp.cols.forEach((col: any, i: number) => {
        obj[col.name] = row[i]?.value ?? null;
      });
      return obj;
    }) || [],
    columns: resp.cols || [],
    lastInsertRowid: resp.last_insert_rowid,
    affectedRowCount: resp.affected_row_count,
  };
}

export async function executeMultiple(sql: string): Promise<void> {
  if (TURSO_URL.startsWith('file:')) {
    const { createClient } = await import('@libsql/client');
    const client = createClient({ url: TURSO_URL });
    await client.executeMultiple(sql);
    return;
  }
  const statements = sql.split(';').filter(s => s.trim()).map(s => ({ type: 'execute', stmt: { sql: s.trim() + ';' } }));
  if (statements.length === 0) return;
  const r = await fetch(TURSO_URL + '/v2/pipeline', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + AUTH_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: statements }),
  });
  const d: any = await r.json();
  for (const result of d.results || []) {
    if (result?.type === 'error') throw new Error(result.error?.message || 'Turso error');
  }
}
