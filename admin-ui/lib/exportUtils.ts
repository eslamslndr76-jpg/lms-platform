/**
 * Shared helpers for the contextual export buttons.
 *
 * Every exportable table lives on the backend as a "dataset" (see
 * backend/src/services/exportDatasets.ts). The pages only need to send the
 * dataset key + the filters currently applied on screen.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ExportColumnMeta {
  key: string;
  header: string;
  type?: string;
  width?: number;
  total?: string;
}

export interface ExportFilterMeta {
  key: string;
  label: string;
  type: 'select' | 'course' | 'group' | 'date' | 'text';
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface ExportDatasetMeta {
  key: string;
  name: string;
  description: string;
  icon: string;
  columns: ExportColumnMeta[];
  filters: ExportFilterMeta[];
}

export type ExportQuery = Record<string, string | number | undefined | null>;

let catalogCache: ExportDatasetMeta[] | null = null;
let catalogPromise: Promise<ExportDatasetMeta[]> | null = null;

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.error) return String(body.error);
  } catch {
    /* non JSON error body */
  }
  return `فشل الطلب (${res.status})`;
}

/** Load the dataset catalog once and share it between all export buttons. */
export async function fetchCatalog(): Promise<ExportDatasetMeta[]> {
  if (catalogCache) return catalogCache;
  if (!catalogPromise) {
    catalogPromise = fetch(`${API_URL}/api/exports/catalog`, { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error(await readError(res));
        const data = await res.json();
        catalogCache = Array.isArray(data?.datasets) ? data.datasets : [];
        return catalogCache as ExportDatasetMeta[];
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}

export function filenameFromResponse(res: Response, fallback: string): string {
  const header = res.headers.get('content-disposition') || '';
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* malformed header — fall back below */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain?.[1] || fallback;
}

export interface DownloadOptions {
  format: 'xlsx' | 'csv';
  params?: ExportQuery;
  columns?: string[];
}

/**
 * Request an export file and hand it to the browser as a download.
 * Returns the filename that was saved (useful for success messages).
 */
export async function downloadExport(
  dataset: string,
  { format, params = {}, columns = [] }: DownloadOptions,
): Promise<string> {
  const search = new URLSearchParams({ format });

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      search.set(key, String(value));
    }
  });

  if (columns.length > 0) search.set('columns', columns.join(','));

  const res = await fetch(`${API_URL}/api/exports/${dataset}?${search.toString()}`, {
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error(await readError(res));

  const blob = await res.blob();
  const filename = filenameFromResponse(res, `${dataset}.${format}`);
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return filename;
}
