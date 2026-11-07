const TURSO_URL = (process.env.TURSO_DATABASE_URL || 'file:./data.db').replace('libsql://', 'https://');
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

function normalizeValue(v: any): any {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && 'value' in v) return v.value;
  return v;
}

interface QueryResult {
  rows: any[];
  columns: { name: string; decltype: string | null }[];
  lastInsertRowid?: string | null;
  affectedRowCount?: number;
}

/**
 * A single libSQL client reused for the whole process in local `file:` mode.
 * Creating a client per query leaks a connection handle every call and can
 * exhaust resources (and crash the server) under load.
 */
let fileClientPromise: Promise<any> | null = null;

function getFileClient(): Promise<any> {
  if (!fileClientPromise) {
    fileClientPromise = import('@libsql/client').then(({ createClient }) =>
      createClient({ url: TURSO_URL }),
    );
  }
  return fileClientPromise;
}

export async function execute(sql: string): Promise<QueryResult> {
  if (TURSO_URL.startsWith('file:')) {
    const client = await getFileClient();
    const result = await client.execute(sql);
    return {
      rows: result.rows,
      columns: (result as any).columns.map((c: any) => ({ name: c.name || c, decltype: c.decltype || null })),
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
  if (result?.type === 'error') throw new Error(result?.error?.message || 'Turso error');
  const resp = result?.response?.result;
  if (!resp) {
    if (!r.ok) throw new Error(`Turso HTTP ${r.status}: ${d?.error?.message || r.statusText}`);
    return { rows: [], columns: [], lastInsertRowid: null, affectedRowCount: 0 } as any;
  }
  return {
    rows: resp.rows?.map((row: any[]) => {
      const obj: any = {};
      (resp.cols || []).forEach((col: any, i: number) => {
        obj[col.name || `col${i}`] = normalizeValue(row[i]);
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
    const client = await getFileClient();
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
