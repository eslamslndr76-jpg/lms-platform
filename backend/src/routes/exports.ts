import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, requirePermission, ADMIN, EMPLOYEE, SECTIONS, getEffectivePermissions, hasPermission } from '../middleware/rbac';
import {
  EXPORT_DATASETS,
  ExportDataset,
  ExportParams,
  findDataset,
  runDataset,
} from '../services/exportDatasets';
import {
  buildBrandedWorkbook,
  loadBranding,
  safeFilename,
  type ExportColumn,
} from '../services/excelExportService';

const router = Router();

// Every export endpoint is restricted to staff.
router.use(authMiddleware, requireRole(ADMIN, EMPLOYEE));

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ─── Helpers ───────────────────────────────────────────────────────

function parseParams(req: Request): ExportParams {
  const q = req.query;
  const num = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    status: typeof q.status === 'string' && q.status !== 'all' ? q.status : undefined,
    courseId: num(q.courseId),
    groupId: num(q.groupId),
    studentId: num(q.studentId),
    lectureId: num(q.lectureId),
    from: typeof q.from === 'string' && q.from ? q.from : undefined,
    to: typeof q.to === 'string' && q.to ? q.to : undefined,
    search: typeof q.search === 'string' && q.search.trim() ? q.search.trim() : undefined,
    limit: num(q.limit),
  };
}

function contentDisposition(filename: string, asciiFallback: string): string {
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function describeFilters(
  dataset: ExportDataset,
  params: ExportParams,
): Promise<{ label: string; value: string }[]> {
  const applied: { label: string; value: string }[] = [];

  if (params.status) {
    const option = dataset.filters
      .find((f) => f.key === 'status')
      ?.options?.find((o) => o.value === params.status);
    applied.push({ label: 'الحالة', value: option?.label || params.status });
  }

  if (params.courseId) {
    const row = await sql('SELECT title_ar FROM courses WHERE id=?', params.courseId);
    applied.push({
      label: 'الكورس',
      value: row.rows.length ? String((row.rows[0] as any).title_ar) : `#${params.courseId}`,
    });
  }

  if (params.groupId) {
    const row = await sql('SELECT name FROM groups WHERE id=?', params.groupId);
    applied.push({
      label: 'المجموعة',
      value: row.rows.length ? String((row.rows[0] as any).name) : `#${params.groupId}`,
    });
  }

  if (params.studentId) {
    const row = await sql('SELECT name FROM users WHERE id=?', params.studentId);
    applied.push({
      label: 'الطالب',
      value: row.rows.length ? String((row.rows[0] as any).name) : `#${params.studentId}`,
    });
  }

  if (params.lectureId) {
    const row = await sql('SELECT topic, date FROM lectures WHERE id=?', params.lectureId);
    const lecture = row.rows[0] as any;
    applied.push({
      label: 'المحاضرة',
      value: lecture ? `${lecture.topic || 'محاضرة'} — ${lecture.date || ''}`.trim() : `#${params.lectureId}`,
    });
  }

  if (params.from) applied.push({ label: 'من تاريخ', value: params.from });
  if (params.to) applied.push({ label: 'إلى تاريخ', value: params.to });
  if (params.search) applied.push({ label: 'بحث', value: params.search });

  return applied;
}

async function exporterIdentity(req: Request): Promise<{ name: string; role: string }> {
  try {
    const row = await sql('SELECT name, role_id FROM users WHERE id=?', req.user!.userId);
    const user = row.rows[0] as any;
    const role = req.user!.role === 'admin' ? 'مدير النظام' : 'موظف';
    return { name: user?.name ? String(user.name) : `#${req.user!.userId}`, role };
  } catch {
    return { name: `#${req.user!.userId}`, role: req.user!.role };
  }
}

function toCsv(columns: ExportColumn[], rows: Record<string, unknown>[]): string {
  const escapeCell = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const text = String(value);
    return /[",;\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [columns.map((c) => escapeCell(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c.key])).join(','));
  }
  // BOM keeps Arabic readable when the CSV is opened directly in Excel.
  return '\uFEFF' + lines.join('\r\n');
}

// ─── Catalog ───────────────────────────────────────────────────────

/** Admins can export everything; staff only sees the sections they hold. */
async function readableSections(req: Request): Promise<Set<string> | 'all'> {
  if (Number(req.user!.roleId) === ADMIN) return 'all';
  const permissions = await getEffectivePermissions(
    Number(req.user!.userId),
    Number(req.user!.roleId),
  );
  return new Set(SECTIONS.map((section) => section.key).filter((key) => hasPermission(permissions, key, 'read')));
}

async function canReadSection(req: Request, section: string): Promise<boolean> {
  const sections = await readableSections(req);
  return sections === 'all' || sections.has(section);
}

router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const sections = await readableSections(req);
    const datasets = EXPORT_DATASETS.filter(
      (dataset) => sections === 'all' || sections.has(dataset.section),
    );
    res.json({
      datasets: datasets.map((dataset) => ({
        key: dataset.key,
        name: dataset.name,
        description: dataset.description,
        icon: dataset.icon,
        section: dataset.section,
        columns: dataset.columns,
        filters: dataset.filters,
      })),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load export catalog' });
  }
});

// ─── Legacy endpoints (kept for backward compatibility) ────────────

router.get('/students/:courseId', requirePermission('students', 'read'), async (req: Request, res: Response) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isFinite(courseId)) return res.status(400).json({ error: 'Invalid course id' });

    const course = await sql('SELECT title_ar FROM courses WHERE id=?', courseId);
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    const courseName = String((course.rows[0] as any).title_ar);

    const students = await sql(
      `SELECT u.name, u.email, u.phone, o.status, oi.price AS amount, o.created_at AS order_date
       FROM order_items oi
       JOIN orders o ON oi.order_id=o.id
       JOIN users u ON o.user_id=u.id
       WHERE oi.course_id=? AND o.status='paid'
       ORDER BY u.name ASC`,
      courseId,
    );

    const columns: ExportColumn[] = [
      { key: 'name', header: 'الاسم', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'amount', header: 'المبلغ', type: 'currency', width: 15, total: 'sum' },
      { key: 'status', header: 'حالة الطلب', type: 'text', width: 14 },
      { key: 'order_date', header: 'تاريخ الدفع', type: 'datetime', width: 18 },
    ];

    const rows = students.rows as Record<string, unknown>[];
    const format = String(req.query.format || 'xlsx');

    if (format === 'json') {
      return res.json({ course: courseName, students: rows });
    }

    if (format === 'csv') {
      const filename = safeFilename(`طلاب-${courseName}`, 'csv');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', contentDisposition(filename, `students-${courseId}.csv`));
      return res.send(toCsv(columns, rows));
    }

    if (format !== 'xlsx') {
      return res.status(400).json({ error: 'Unsupported format. Use xlsx, csv or json.' });
    }

    const branding = await loadBranding();
    const identity = await exporterIdentity(req);
    const buffer = await buildBrandedWorkbook({
      sheetName: 'الطلاب',
      title: `طلاب كورس: ${courseName}`,
      description: 'قائمة الطلاب الذين تم الدفع لهم في هذا الكورس.',
      columns,
      rows,
      branding,
      filters: [{ label: 'الكورس', value: courseName }],
      exportedBy: identity.name,
      exportedByRole: identity.role,
    });

    const filename = safeFilename(`طلاب-${courseName}`);
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', contentDisposition(filename, `students-${courseId}.xlsx`));
    return res.send(buffer);
  } catch (err: any) {
    console.error('[Exports] students error:', err?.message);
    res.status(500).json({ error: 'Failed to export students' });
  }
});

// ─── Generic dataset export ────────────────────────────────────────

router.get('/:dataset', async (req: Request, res: Response) => {
  const dataset = findDataset(req.params.dataset);
  if (!dataset) {
    return res.status(404).json({
      error: 'Unknown dataset',
      available: EXPORT_DATASETS.map((d) => d.key),
    });
  }

  try {
    if (!(await canReadSection(req, dataset.section))) {
      return res.status(403).json({ error: `No read permission for ${dataset.section}` });
    }
    const params = parseParams(req);
    const isPreview = req.query.preview === '1' || req.query.preview === 'true';
    if (isPreview) params.limit = Math.min(params.limit || 10, 50);

    // Optional column selection (comma separated keys) — keeps the workbook focused.
    const requestedColumns =
      typeof req.query.columns === 'string' && req.query.columns.trim()
        ? req.query.columns.split(',').map((c) => c.trim()).filter(Boolean)
        : [];
    const columns = requestedColumns.length
      ? dataset.columns.filter((c) => requestedColumns.includes(c.key))
      : dataset.columns;
    if (columns.length === 0) {
      return res.status(400).json({ error: 'No valid columns selected' });
    }

    const rows = await runDataset(dataset, params);
    const format = String(req.query.format || 'xlsx');

    // ── Preview for the admin UI ────────────────────────────────
    if (isPreview) {
      return res.json({
        columns,
        rows,
        total: rows.length,
      });
    }

    if (format === 'json') {
      return res.json({ dataset: dataset.key, rows, count: rows.length });
    }

    if (format === 'csv') {
      const filename = safeFilename(dataset.name, 'csv');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        contentDisposition(filename, `${dataset.key}-${new Date().toISOString().slice(0, 10)}.csv`),
      );
      return res.send(toCsv(columns, rows));
    }

    if (format !== 'xlsx') {
      return res.status(400).json({ error: 'Unsupported format. Use xlsx, csv or json.' });
    }

    const [branding, filters, identity] = await Promise.all([
      loadBranding(),
      describeFilters(dataset, params),
      exporterIdentity(req),
    ]);
    const footerNote = dataset.buildNote ? await dataset.buildNote(params) : undefined;

    const buffer = await buildBrandedWorkbook({
      sheetName: dataset.name,
      title: dataset.name,
      description: dataset.description,
      columns,
      rows,
      branding,
      filters,
      exportedBy: identity.name,
      exportedByRole: identity.role,
      footerNote,
    });

    const filename = safeFilename(
      [dataset.name, ...filters.filter((f) => f.label === 'الكورس' || f.label === 'المجموعة').map((f) => f.value)]
        .filter(Boolean)
        .join('-'),
    );
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader(
      'Content-Disposition',
      contentDisposition(filename, `${dataset.key}-${new Date().toISOString().slice(0, 10)}.xlsx`),
    );
    res.setHeader('Content-Length', String(buffer.length));
    return res.send(buffer);
  } catch (err: any) {
    console.error(`[Exports] ${dataset.key} error:`, err?.message);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

export default router;
