import { sql } from '../db/helpers';
import {
  formatCairoDateTime,
  type ExportColumn,
  type SheetBuildOptions,
} from './excelExportService';

/**
 * Registry of every exportable dataset in the system.
 *
 * Adding a new exportable table = adding one entry here; the API route, the
 * branding, the styling and the admin UI (which reads /api/exports/catalog)
 * pick it up automatically.
 */

export interface ExportFilterDef {
  key: 'status' | 'courseId' | 'groupId' | 'from' | 'to' | 'search';
  label: string;
  type: 'select' | 'course' | 'group' | 'date' | 'text';
  placeholder?: string;
  options?: { value: string; label: string }[];
}

export interface ExportParams {
  status?: string;
  courseId?: number;
  groupId?: number;
  /** Restrict rows to a single student (used by the student detail page). */
  studentId?: number;
  /** Restrict rows to a single lecture (used by the attendance modal). */
  lectureId?: number;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

interface Query {
  text: string;
  args: unknown[];
}

export interface ExportDataset {
  key: string;
  name: string;
  description: string;
  icon: string;
  /** Permission section required to export this dataset (see middleware/rbac SECTIONS). */
  section: string;
  columns: ExportColumn[];
  filters: ExportFilterDef[];
  build: (params: ExportParams) => Query;
  /**
   * Optional per-scope column set (e.g. drop the course column when the export
   * is for a single course). Falls back to `columns`.
   */
  resolveColumns?: (params: ExportParams) => ExportColumn[];
  /**
   * Optional label/value report info block rendered above the table in the
   * branded workbook (only for narrow scopes, e.g. one course/group/lecture).
   */
  buildInfo?: (
    params: ExportParams,
    rows: Record<string, unknown>[],
  ) => Promise<{ label: string; value: string }[] | undefined>;
  /** Optional extra footer line (aggregates that do not fit a row, e.g. survey averages). */
  buildNote?: (params: ExportParams) => Promise<string | undefined>;
  /** Optional per-row translator applied in runDataset (keeps XLSX, CSV and JSON consistent). */
  mapRow?: (row: Record<string, unknown>) => Record<string, unknown>;
}

// ─── Shared filter fragments ───────────────────────────────────────

function dateClause(column: string, params: ExportParams, args: unknown[]): string {
  let clause = '';
  if (params.from) {
    clause += ` AND date(${column}) >= date(?)`;
    args.push(params.from);
  }
  if (params.to) {
    clause += ` AND date(${column}) <= date(?)`;
    args.push(params.to);
  }
  return clause;
}

function searchClause(columns: string[], params: ExportParams, args: unknown[]): string {
  const term = params.search?.trim();
  if (!term) return '';
  const like = `%${term}%`;
  const parts = columns.map((c) => `${c} LIKE ?`);
  columns.forEach(() => args.push(like));
  return ` AND (${parts.join(' OR ')})`;
}

/** 'YYYY-MM-DD…' → 'd/m/yyyy' for the report info block. */
function formatDateShort(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${Number(m[3])}/${Number(m[2])}/${Number(m[1])}`;
}

/** 'YYYY-MM-DD…' → 'd/m' for matrix lecture headers. */
function formatDayMonth(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return `${Number(m[3])}/${Number(m[2])}`;
}

export type AttendanceCellState = 'attended' | 'absent' | 'unconfirmed' | 'not_held';

export const ATTENDANCE_STATE_LABELS: Record<AttendanceCellState, string> = {
  attended: '✓ حضر',
  absent: '✗ غاب',
  unconfirmed: '؟ غير مؤكدة',
  not_held: '— لم تُعقد',
};

const ATTENDANCE_STATE_BADGE: ExportColumn['badge'] = {
  attended: { label: '✓ حضر', tone: 'success' },
  absent: { label: '✗ غاب', tone: 'danger' },
  unconfirmed: { label: '؟ غير مؤكدة', tone: 'neutral' },
  not_held: { label: '— لم تُعقد', tone: 'neutral' },
};

const MATRIX_CELL_BADGE: ExportColumn['badge'] = {
  '✓ حضر': { label: '✓ حضر', tone: 'success' },
  '✗ غاب': { label: '✗ غاب', tone: 'danger' },
  '؟ غير مؤكدة': { label: '؟ غير مؤكدة', tone: 'neutral' },
  '— لم تُعقد': { label: '— لم تُعقد', tone: 'neutral' },
};

const ATTENDANCE_LEGEND_NOTE =
  'مفتاح الرموز: ✓ حضر (حضر المحاضرة)  |  ✗ غاب (محاضرة معقودة ولم يحضر)  |  ؟ غير مؤكدة (مرّ تاريخها ولم تُؤكَّد بعد ولا تُحسب غياباً)  |  — لم تُعقد (لم يُسجَّل عقدها بعد ولا تدخل في الغياب أو النسبة)';

function resolveAttendanceState(input: {
  attended: unknown;
  isCompleted: unknown;
  hasAnyAttendance: unknown;
  lectureDate: unknown;
  todayCairo: string;
}): AttendanceCellState {
  if (Number(input.attended) === 1) return 'attended';
  const held = Number(input.isCompleted) === 1 || Number(input.hasAnyAttendance) === 1;
  if (held) return 'absent';
  const dateStr = String(input.lectureDate ?? '').slice(0, 10);
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && dateStr < input.todayCairo) {
    return 'unconfirmed';
  }
  return 'not_held';
}

function formatCairoFromRaw(value: unknown): string {
  if (!value) return '—';
  const raw = String(value).trim();
  if (!raw) return '—';
  const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? raw : formatCairoDateTime(d);
}

// ─── Arabic value dictionaries ─────────────────────────────────────

const VERIFICATION_METHOD_LABELS: Record<string, string> = {
  qr: 'كود QR',
  manual: 'يدوي',
  bluetooth: 'بلوتوث',
  code: 'كود',
};

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  review: 'قيد المراجعة',
  paid: 'مدفوع',
  cancelled: 'ملغي',
};

const ORDER_STATUS_BADGE: ExportColumn['badge'] = {
  'مدفوع': { label: 'مدفوع', tone: 'success' },
  'قيد المراجعة': { label: 'قيد المراجعة', tone: 'neutral' },
  'قيد الانتظار': { label: 'قيد الانتظار', tone: 'neutral' },
  'ملغي': { label: 'ملغي', tone: 'danger' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي (خزنة المعهد)',
  wallet: 'محفظة إلكترونية',
  instapay: 'إنستاباي',
  transfer: 'تحويل بنكي',
  bank_transfer: 'تحويل بنكي',
  free: 'مجاني',
};

const GROUP_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  active: 'نشطة',
  completed: 'مكتملة',
  cancelled: 'ملغاة',
};

const GROUP_STATUS_BADGE: ExportColumn['badge'] = {
  'نشطة': { label: 'نشطة', tone: 'success' },
  'مكتملة': { label: 'مكتملة', tone: 'success' },
  'قيد الانتظار': { label: 'قيد الانتظار', tone: 'neutral' },
  'ملغاة': { label: 'ملغاة', tone: 'danger' },
};

const EVAL_STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  submitted: 'تم الإرسال',
};

const EVAL_STATUS_BADGE: ExportColumn['badge'] = {
  'تم الإرسال': { label: 'تم الإرسال', tone: 'success' },
  'مسودة': { label: 'مسودة', tone: 'neutral' },
};

const CERT_STATUS_LABELS: Record<string, string> = {
  active: 'سارية',
  revoked: 'مسحوبة',
};

const CERT_STATUS_BADGE: ExportColumn['badge'] = {
  'سارية': { label: 'سارية', tone: 'success' },
  'مسحوبة': { label: 'مسحوبة', tone: 'danger' },
};

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  order_created: 'إنشاء طلب',
  order_paid: 'تأكيد دفع',
  order_cancelled: 'إلغاء طلب',
  order_expired: 'انتهاء مهلة الحجز',
  order_receipt_uploaded: 'رفع إيصال',
  order_course_removed: 'إزالة كورس من طلب',
  attendance_confirmed: 'تسجيل حضور',
  assigned_to_group: 'تسكين في مجموعة',
  removed_from_group: 'إزالة من مجموعة',
  moved_to_group: 'نقل لمجموعة',
  certificate_issued: 'إصدار شهادة',
  certificate_revoked: 'سحب شهادة',
  certificate_restored: 'استعادة شهادة',
  account_created: 'إنشاء حساب',
  password_reset_done: 'إعادة تعيين كلمة المرور',
  instructor_eval_opened: 'فتح تقييم المحاضر',
  instructor_eval_submitted: 'إرسال تقييم المحاضر',
  survey_opened: 'فتح الاستبيان',
  app_update: 'تحديث التطبيق',
};

function translate(value: unknown, dict: Record<string, string>, fallback = '—'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const key = String(value).trim();
  return dict[key] ?? key;
}

const ACTIVE_FILTER: ExportFilterDef = {
  key: 'status',
  label: 'الحالة',
  type: 'select',
  options: [
    { value: 'active', label: 'نشط' },
    { value: 'inactive', label: 'غير نشط' },
  ],
};

const RANGE_FILTERS: ExportFilterDef[] = [
  { key: 'from', label: 'من تاريخ', type: 'date' },
  { key: 'to', label: 'إلى تاريخ', type: 'date' },
];

const SEARCH_FILTER = (placeholder: string): ExportFilterDef => ({
  key: 'search',
  label: 'بحث',
  type: 'text',
  placeholder,
});

// ─── Datasets ──────────────────────────────────────────────────────

export const EXPORT_DATASETS: ExportDataset[] = [
  {
    key: 'students',
    section: 'students',
    name: 'الطلاب',
    description: 'كل حسابات الطلاب مع عدد مجموعاتهم وطلباتهم المدفوعة.',
    icon: '👥',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'name', header: 'الاسم', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'groups_count', header: 'عدد المجموعات', type: 'number', width: 14, total: 'sum' },
      { key: 'paid_orders', header: 'طلبات مدفوعة', type: 'number', width: 14, total: 'sum' },
      { key: 'is_active', header: 'الحالة', type: 'boolean', width: 10 },
      { key: 'created_at', header: 'تاريخ التسجيل', type: 'date', width: 16 },
    ],
    filters: [SEARCH_FILTER('اسم / بريد / هاتف'), ACTIVE_FILTER, ...RANGE_FILTERS],
    build: (params) => {
      const args: unknown[] = [];
      let where = 'u.role_id = 3';
      where += searchClause(['u.name', 'u.email', 'u.phone'], params, args);
      if (params.status === 'active') where += ' AND COALESCE(u.is_active,1) = 1';
      if (params.status === 'inactive') where += ' AND COALESCE(u.is_active,1) = 0';
      where += dateClause('u.created_at', params, args);
      return {
        text: `SELECT u.id, u.name, u.email, u.phone, u.created_at,
                 CASE WHEN COALESCE(u.is_active,1)=1 THEN 1 ELSE 0 END AS is_active,
                 (SELECT COUNT(*) FROM group_students gs WHERE gs.user_id = u.id) AS groups_count,
                 (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS paid_orders
               FROM users u WHERE ${where} ORDER BY u.created_at DESC`,
        args,
      };
    },
  },
  {
    key: 'orders',
    section: 'orders',
    name: 'الطلبات',
    description: 'كل طلبات الشراء مع الطالب والكورس والمبلغ وطريقة الدفع.',
    icon: '📋',
    columns: [
      { key: 'id', header: 'رقم الطلب', type: 'number', width: 12 },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'amount', header: 'المبلغ', type: 'currency', width: 15, total: 'sum' },
      { key: 'status', header: 'الحالة', type: 'text', width: 14, badge: ORDER_STATUS_BADGE },
      { key: 'payment_method', header: 'طريقة الدفع', type: 'text', width: 18 },
      { key: 'created_at', header: 'تاريخ الطلب', type: 'datetime', width: 18 },
      { key: 'notes', header: 'ملاحظات', type: 'text', width: 30 },
    ],
    filters: [
      {
        key: 'status',
        label: 'حالة الطلب',
        type: 'select',
        options: [
          { value: 'pending', label: 'قيد الانتظار' },
          { value: 'review', label: 'قيد المراجعة' },
          { value: 'paid', label: 'مدفوع' },
          { value: 'cancelled', label: 'ملغي' },
        ],
      },
      { key: 'courseId', label: 'الكورس', type: 'course' },
      SEARCH_FILTER('اسم الطالب / البريد'),
      ...RANGE_FILTERS,
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.status) {
        where += ' AND o.status = ?';
        args.push(params.status);
      }
      if (params.courseId) {
        where += ' AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.course_id = ?)';
        args.push(params.courseId);
      }
      if (params.studentId) {
        where += ' AND o.user_id = ?';
        args.push(params.studentId);
      }
      where += searchClause(['u.name', 'u.email'], params, args);
      where += dateClause('o.created_at', params, args);
      return {
        text: `SELECT o.id, u.name AS student, u.email,
                 (SELECT GROUP_CONCAT(c.title_ar, '، ') FROM order_items oi
                  JOIN courses c ON oi.course_id = c.id WHERE oi.order_id = o.id) AS course,
                 o.amount, o.status,
                 COALESCE(o.payment_method,'cash') AS payment_method, o.created_at, o.notes
               FROM orders o
               JOIN users u ON o.user_id = u.id
               WHERE ${where} ORDER BY o.created_at DESC`,
        args,
      };
    },
    mapRow: (row) => ({
      ...row,
      status: translate(row.status, ORDER_STATUS_LABELS),
      payment_method: translate(row.payment_method, PAYMENT_METHOD_LABELS),
    }),
  },
  {
    key: 'courses',
    section: 'courses',
    name: 'الكورسات',
    description: 'كل الكورسات مع التصنيف والسعر وعدد الطلاب المدفوعين.',
    icon: '📚',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'title_ar', header: 'اسم الكورس', type: 'text' },
      { key: 'title_en', header: 'الاسم بالإنجليزية', type: 'text', width: 24 },
      { key: 'category', header: 'التصنيف', type: 'text', width: 18 },
      { key: 'price', header: 'السعر', type: 'currency', width: 15, total: 'sum' },
      { key: 'lecture_count', header: 'عدد المحاضرات', type: 'number', width: 15, total: 'sum' },
      { key: 'max_students', header: 'الحد الأقصى', type: 'number', width: 12 },
      { key: 'paid_students', header: 'طلاب مدفوعون', type: 'number', width: 14, total: 'sum' },
      { key: 'groups_count', header: 'المجموعات', type: 'number', width: 12, total: 'sum' },
      { key: 'is_active', header: 'الحالة', type: 'boolean', width: 10 },
      { key: 'created_at', header: 'تاريخ الإنشاء', type: 'date', width: 16 },
    ],
    filters: [SEARCH_FILTER('اسم الكورس'), ACTIVE_FILTER, ...RANGE_FILTERS],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      where += searchClause(['c.title_ar', 'c.title_en'], params, args);
      if (params.status === 'active') where += ' AND c.is_active = 1';
      if (params.status === 'inactive') where += ' AND c.is_active = 0';
      where += dateClause('c.created_at', params, args);
      return {
        text: `SELECT c.id, c.title_ar, c.title_en, cat.name_ar AS category, c.price, c.lecture_count,
                 c.max_students, c.created_at,
                 CASE WHEN c.is_active = 1 THEN 1 ELSE 0 END AS is_active,
                 (SELECT COUNT(*) FROM order_items oi JOIN orders o ON oi.order_id = o.id
                  WHERE oi.course_id = c.id AND o.status = 'paid') AS paid_students,
                 (SELECT COUNT(*) FROM groups g WHERE g.course_id = c.id) AS groups_count
               FROM courses c LEFT JOIN categories cat ON c.category_id = cat.id
               WHERE ${where} ORDER BY c.created_at DESC`,
        args,
      };
    },
  },
  {
    key: 'categories',
    section: 'categories',
    name: 'التصنيفات',
    description: 'تصنيفات الكورسات مع عدد الكورسات في كل تصنيف.',
    icon: '🏷️',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'name_ar', header: 'الاسم', type: 'text' },
      { key: 'name_en', header: 'الاسم بالإنجليزية', type: 'text' },
      { key: 'description', header: 'الوصف', type: 'text', width: 36 },
      { key: 'courses_count', header: 'عدد الكورسات', type: 'number', width: 14, total: 'sum' },
      { key: 'created_at', header: 'تاريخ الإنشاء', type: 'date', width: 16 },
    ],
    filters: [SEARCH_FILTER('اسم التصنيف')],
    build: (params) => {
      const args: unknown[] = [];
      const where = '1=1' + searchClause(['name_ar', 'name_en'], params, args);
      return {
        text: `SELECT cat.id, cat.name_ar, cat.name_en, cat.description, cat.created_at,
                 (SELECT COUNT(*) FROM courses c WHERE c.category_id = cat.id) AS courses_count
               FROM categories cat WHERE ${where} ORDER BY cat.name_ar ASC`,
        args,
      };
    },
  },
  {
    key: 'groups',
    section: 'groups',
    name: 'المجموعات',
    description: 'كل المجموعات مع الكورس والمدرب والحالة وعدد الطلاب والمحاضرات.',
    icon: '🧩',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'name', header: 'المجموعة', type: 'text' },
      { key: 'instructor_name', header: 'المدرب', type: 'text', width: 18 },
      { key: 'location', header: 'المكان', type: 'text', width: 18 },
      { key: 'start_date', header: 'تبدأ', type: 'date', width: 13 },
      { key: 'end_date', header: 'تنتهي', type: 'date', width: 13 },
      { key: 'students_count', header: 'الطلاب', type: 'number', width: 10, total: 'sum' },
      { key: 'max_students', header: 'السعة', type: 'number', width: 10 },
      { key: 'lectures_count', header: 'المحاضرات', type: 'number', width: 12, total: 'sum' },
      { key: 'completed_lectures', header: 'مكتملة', type: 'number', width: 10, total: 'sum' },
      { key: 'status', header: 'الحالة', type: 'text', width: 13, badge: GROUP_STATUS_BADGE },
    ],
    filters: [
      {
        key: 'status',
        label: 'حالة المجموعة',
        type: 'select',
        options: [
          { value: 'pending', label: 'قيد الانتظار' },
          { value: 'active', label: 'نشطة' },
          { value: 'completed', label: 'مكتملة' },
          { value: 'cancelled', label: 'ملغاة' },
        ],
      },
      { key: 'courseId', label: 'الكورس', type: 'course' },
      SEARCH_FILTER('اسم المجموعة / المدرب'),
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.status) {
        where += ' AND g.status = ?';
        args.push(params.status);
      }
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      where += searchClause(['g.name', 'g.instructor_name'], params, args);
      return {
        text: `SELECT g.id, c.title_ar AS course, g.name, g.instructor_name, g.location,
                 g.start_date, g.end_date, g.max_students, g.status,
                 (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id = g.id) AS students_count,
                 (SELECT COUNT(*) FROM lectures l WHERE l.group_id = g.id) AS lectures_count,
                 (SELECT COUNT(*) FROM lectures l WHERE l.group_id = g.id AND l.is_completed = 1) AS completed_lectures
               FROM groups g JOIN courses c ON g.course_id = c.id
               WHERE ${where} ORDER BY c.title_ar ASC, g.name ASC`,
        args,
      };
    },
    mapRow: (row) => ({ ...row, status: translate(row.status, GROUP_STATUS_LABELS) }),
  },
  {
    key: 'lectures',
    section: 'groups',
    name: 'المحاضرات',
    description: 'جدول المحاضرات لكل مجموعة مع حالة الإتمام وعدد الحاضرين.',
    icon: '🗓️',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'group_name', header: 'المجموعة', type: 'text' },
      { key: 'date', header: 'التاريخ', type: 'date', width: 13 },
      { key: 'time_from', header: 'من', type: 'text', width: 9 },
      { key: 'time_to', header: 'إلى', type: 'text', width: 9 },
      { key: 'topic', header: 'الموضوع', type: 'text', width: 30 },
      { key: 'location', header: 'المكان', type: 'text', width: 18 },
      { key: 'attendees', header: 'الحضور', type: 'number', width: 10, total: 'sum' },
      { key: 'is_completed', header: 'تمت؟', type: 'boolean', width: 10 },
      { key: 'completed_at', header: 'تاريخ الإتمام', type: 'datetime', width: 18 },
    ],
    filters: [
      {
        key: 'status',
        label: 'حالة المحاضرة',
        type: 'select',
        options: [
          { value: 'completed', label: 'مكتملة' },
          { value: 'pending', label: 'لم تكتمل' },
        ],
      },
      { key: 'courseId', label: 'الكورس', type: 'course' },
      { key: 'groupId', label: 'المجموعة', type: 'group' },
      ...RANGE_FILTERS,
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.status === 'completed') where += ' AND l.is_completed = 1';
      if (params.status === 'pending') where += ' AND l.is_completed = 0';
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      if (params.groupId) {
        where += ' AND l.group_id = ?';
        args.push(params.groupId);
      }
      where += dateClause('l.date', params, args);
      return {
        text: `SELECT l.id, c.title_ar AS course, g.name AS group_name, l.date, l.time_from, l.time_to,
                 l.topic, l.location, l.completed_at,
                 CASE WHEN l.is_completed = 1 THEN 1 ELSE 0 END AS is_completed,
                 (SELECT COUNT(*) FROM lecture_attendance a WHERE a.lecture_id = l.id AND a.attended = 1) AS attendees
               FROM lectures l
               JOIN groups g ON l.group_id = g.id
               JOIN courses c ON g.course_id = c.id
               WHERE ${where} ORDER BY l.date DESC, l.sort_order ASC`,
        args,
      };
    },
  },
  {
    key: 'attendance',
    section: 'groups',
    name: 'سجلات الحضور',
    description: 'حضور وغياب كل طالب مسجَّل في كل محاضرة مع طريقة التحقق والوقت.',
    icon: '✅',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'group_name', header: 'المجموعة', type: 'text' },
      { key: 'lecture_date', header: 'تاريخ المحاضرة', type: 'date', width: 15 },
      { key: 'topic', header: 'الموضوع', type: 'text', width: 26 },
      {
        key: 'attended',
        header: 'الحالة',
        type: 'text',
        width: 15,
        badge: ATTENDANCE_STATE_BADGE,
      },
      { key: 'verification_method', header: 'طريقة التحقق', type: 'text', width: 14 },
      { key: 'attended_at', header: 'وقت الحضور', type: 'datetime', width: 18 },
    ],
    filters: [
      {
        key: 'status',
        label: 'الحضور',
        type: 'select',
        options: [
          { value: 'attended', label: 'حضر' },
          { value: 'absent', label: 'لم يحضر' },
        ],
      },
      { key: 'courseId', label: 'الكورس', type: 'course' },
      { key: 'groupId', label: 'المجموعة', type: 'group' },
      SEARCH_FILTER('اسم الطالب'),
      ...RANGE_FILTERS,
    ],
    resolveColumns: (params) => {
      // Narrow scope: the course (and the group, when it is a single one) move
      // to the workbook report info block — see buildInfo below.
      const hide = new Set<string>();
      if (params.lectureId || params.groupId) {
        hide.add('course');
        hide.add('group_name');
      } else if (params.courseId) {
        hide.add('course');
      }
      const full = EXPORT_DATASETS.find((d) => d.key === 'attendance')!.columns;
      return hide.size ? full.filter((c) => !hide.has(c.key)) : full;
    },
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.status === 'attended') where += ' AND la.attended = 1';
      if (params.status === 'absent') {
        where +=
          ' AND COALESCE(la.attended, 0) = 0 AND (l.is_completed = 1 OR EXISTS (SELECT 1 FROM lecture_attendance a2 WHERE a2.lecture_id = l.id AND a2.attended = 1))';
      }
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      if (params.groupId) {
        where += ' AND l.group_id = ?';
        args.push(params.groupId);
      }
      if (params.studentId) {
        where += ' AND u.id = ?';
        args.push(params.studentId);
      }
      if (params.lectureId) {
        where += ' AND l.id = ?';
        args.push(params.lectureId);
      }
      where += searchClause(['u.name', 'u.phone'], params, args);
      where += dateClause('l.date', params, args);
      // Every distinct enrolled student × every lecture of their group, with the
      // attendance row LEFT JOINed on — absentees come from the join, never
      // inserted into the database for exporting.
      return {
        text: `SELECT la.id AS id, u.id AS student_id, u.name AS student, u.phone,
                 c.title_ar AS course, g.name AS group_name,
                 l.id AS lecture_id, l.date AS lecture_date, l.topic,
                 l.is_completed,
                 EXISTS (SELECT 1 FROM lecture_attendance a2 WHERE a2.lecture_id = l.id AND a2.attended = 1) AS lecture_has_attendance,
                 COALESCE(la.attended, 0) AS attended,
                 la.verification_method, la.attended_at
               FROM groups g
               JOIN lectures l ON l.group_id = g.id
               JOIN (SELECT DISTINCT group_id, user_id FROM group_students) gs ON gs.group_id = g.id
               JOIN users u ON u.id = gs.user_id
               LEFT JOIN lecture_attendance la ON la.lecture_id = l.id AND la.user_id = u.id
               LEFT JOIN courses c ON c.id = g.course_id
               WHERE ${where} ORDER BY u.name ASC, l.date ASC, l.sort_order ASC`,
        args,
      };
    },
    buildInfo: async (params, rows) => {
      // Report info block only when the scope is a single course/group/lecture.
      if (!params.lectureId && !params.groupId && !params.courseId) return undefined;

      let scope: Record<string, any> | null = null;
      if (params.lectureId) {
        const r = await sql(
          `SELECT c.title_ar AS course, g.name AS group_name, g.instructor_name, g.location,
                  p.name AS place_name, c.course_mode
           FROM lectures l
           JOIN groups g ON l.group_id = g.id
           LEFT JOIN courses c ON c.id = g.course_id
           LEFT JOIN places p ON p.id = g.place_id
           WHERE l.id = ? LIMIT 1`,
          params.lectureId,
        );
        scope = (r.rows[0] as any) ?? null;
      } else if (params.groupId) {
        const r = await sql(
          `SELECT c.title_ar AS course, g.name AS group_name, g.instructor_name, g.location,
                  p.name AS place_name, c.course_mode
           FROM groups g
           LEFT JOIN courses c ON c.id = g.course_id
           LEFT JOIN places p ON p.id = g.place_id
           WHERE g.id = ? LIMIT 1`,
          params.groupId,
        );
        scope = (r.rows[0] as any) ?? null;
      } else if (params.courseId) {
        const r = await sql('SELECT title_ar AS course FROM courses WHERE id = ? LIMIT 1', params.courseId);
        scope = (r.rows[0] as any) ?? null;
      }
      if (!scope) return undefined;

      // Lecture window and the counts come from the exported rows themselves
      // (each row = one student × one lecture of the scope), so the block
      // always matches exactly what is in the sheet — including any status filter.
      const dates = [...new Set(rows.map((r) => String(r.lecture_date ?? '')).filter(Boolean))].sort();
      const datesText =
        dates.length === 0
          ? '—'
          : dates.length === 1
            ? formatDateShort(dates[0])
            : dates.length <= 3
              ? dates.map(formatDateShort).join('، ')
              : `من ${formatDateShort(dates[0])} إلى ${formatDateShort(dates[dates.length - 1])} (${dates.length} محاضرات)`;
      const students = new Set(rows.map((r) => String(r.student_id ?? ''))).size;
      const present = rows.filter((r) => r.attended === 'attended').length;
      const absent = rows.filter((r) => r.attended === 'absent').length;
      const place =
        scope.course_mode !== 'offline' ? 'أونلاين' : scope.place_name || scope.location || '—';

      const info: { label: string; value: string }[] = [{ label: 'الكورس', value: scope.course || '—' }];
      if (params.lectureId || params.groupId) {
        info.push(
          { label: 'المجموعة', value: scope.group_name || '—' },
          { label: 'المحاضر', value: scope.instructor_name || '—' },
          { label: 'المكان', value: place },
        );
      }
      info.push(
        { label: 'تواريخ المحاضرات', value: datesText },
        { label: 'عدد الطلاب', value: String(students) },
        { label: 'الحاضرون', value: String(present) },
        { label: 'الغائبون', value: String(absent) },
      );
      return info;
    },
    buildNote: async () => ATTENDANCE_LEGEND_NOTE,
    mapRow: (row) => {
      const todayCairo = formatCairoDateTime(new Date()).slice(0, 10);
      const state = resolveAttendanceState({
        attended: row.attended,
        isCompleted: row.is_completed,
        hasAnyAttendance: row.lecture_has_attendance,
        lectureDate: row.lecture_date,
        todayCairo,
      });
      return {
        ...row,
        attended: state,
        verification_method:
          state === 'attended'
            ? translate(row.verification_method, VERIFICATION_METHOD_LABELS)
            : '—',
      };
    },
  },
  {
    key: 'enrollments',
    section: 'students',
    name: 'تسكين الطلاب',
    description: 'كل عمليات التسكين: أي طالب في أي مجموعة وأي كورس ومتى.',
    icon: '🔗',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'group_name', header: 'المجموعة', type: 'text' },
      { key: 'status', header: 'حالة المجموعة', type: 'text', width: 14, badge: GROUP_STATUS_BADGE },
      { key: 'joined_at', header: 'تاريخ التسكين', type: 'datetime', width: 18 },
    ],
    filters: [
      { key: 'courseId', label: 'الكورس', type: 'course' },
      { key: 'groupId', label: 'المجموعة', type: 'group' },
      SEARCH_FILTER('اسم الطالب / البريد'),
      ...RANGE_FILTERS,
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      if (params.groupId) {
        where += ' AND gs.group_id = ?';
        args.push(params.groupId);
      }
      if (params.studentId) {
        where += ' AND gs.user_id = ?';
        args.push(params.studentId);
      }
      where += searchClause(['u.name', 'u.email'], params, args);
      where += dateClause('gs.joined_at', params, args);
      return {
        text: `SELECT gs.id, u.name AS student, u.email, u.phone, c.title_ar AS course,
                 g.name AS group_name, g.status, gs.joined_at
               FROM group_students gs
               JOIN users u ON gs.user_id = u.id
               JOIN groups g ON gs.group_id = g.id
               JOIN courses c ON g.course_id = c.id
               WHERE ${where} ORDER BY gs.joined_at DESC`,
        args,
      };
    },
    mapRow: (row) => ({ ...row, status: translate(row.status, GROUP_STATUS_LABELS) }),
  },
  {
    key: 'group_roster',
    section: 'groups',
    name: 'المجموعات وطلابها',
    description: 'قائمة كل مجموعة مع طلابها وبيانات الوحدة/الجهة وتاريخ التسكين.',
    icon: '🧾',
    columns: [
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'group_name', header: 'المجموعة', type: 'text' },
      { key: 'instructor_name', header: 'المدرب', type: 'text', width: 18 },
      { key: 'group_status', header: 'حالة المجموعة', type: 'text', width: 14, badge: GROUP_STATUS_BADGE },
      { key: 'start_date', header: 'تبدأ', type: 'date', width: 13 },
      { key: 'end_date', header: 'تنتهي', type: 'date', width: 13 },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'unit_name', header: 'الوحدة/الجهة', type: 'text', width: 24 },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text', width: 26 },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'joined_at', header: 'تاريخ التسكين', type: 'datetime', width: 18 },
    ],
    filters: [
      { key: 'courseId', label: 'الكورس', type: 'course' },
      { key: 'groupId', label: 'المجموعة', type: 'group' },
      SEARCH_FILTER('اسم الطالب / الجهة'),
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      if (params.groupId) {
        where += ' AND g.id = ?';
        args.push(params.groupId);
      }
      where += searchClause(['u.name', 'u.university_name'], params, args);
      return {
        text: `SELECT c.title_ar AS course, g.name AS group_name, g.instructor_name, g.status AS group_status,
                 g.start_date, g.end_date, u.name AS student, u.university_name AS unit_name,
                 u.email, u.phone, gs.joined_at
               FROM group_students gs
               JOIN users u ON gs.user_id = u.id
               JOIN groups g ON gs.group_id = g.id
               JOIN courses c ON g.course_id = c.id
               WHERE ${where} ORDER BY c.title_ar ASC, g.name ASC, u.name ASC`,
        args,
      };
    },
    mapRow: (row) => ({ ...row, group_status: translate(row.group_status, GROUP_STATUS_LABELS) }),
  },
  {
    key: 'survey_results',
    section: 'groups',
    name: 'نتائج الاستبيان',
    description: 'ردود استبيان الطالب مع درجات البنود ومتوسطاتها ونسبة من أجاب.',
    icon: '⭐',
    columns: [
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'group_name', header: 'المجموعة', type: 'text' },
      { key: 'student', header: 'الطالب', type: 'text', width: 22 },
      { key: 'anonymous', header: 'مجهول؟', type: 'boolean', width: 10 },
      { key: 'lecturer_knowledge', header: 'إلمام المدرب', type: 'number', width: 13 },
      { key: 'lecturer_communication', header: 'توصيل المعلومات', type: 'number', width: 16 },
      { key: 'lecturer_organization', header: 'تنظيم العرض', type: 'number', width: 14 },
      { key: 'lecturer_cooperation', header: 'التعاون', type: 'number', width: 12 },
      { key: 'lecturer_motivation', header: 'التحفيز', type: 'number', width: 12 },
      { key: 'program_content', header: 'محتوى البرنامج', type: 'number', width: 15 },
      { key: 'program_materials', header: 'المادة التدريبية', type: 'number', width: 15 },
      { key: 'program_material_organization', header: 'تنظيم المادة', type: 'number', width: 14 },
      { key: 'program_goals', header: 'تحقيق الأهداف', type: 'number', width: 14 },
      { key: 'program_organization', header: 'تنظيم البرنامج', type: 'number', width: 14 },
      { key: 'program_duration', header: 'المدة والتوقيت', type: 'number', width: 14 },
      { key: 'program_place', header: 'مكان البرنامج', type: 'number', width: 14 },
      { key: 'helped_develop', header: 'ساعد على التطوير؟', type: 'text', width: 16 },
      { key: 'submitted_at', header: 'وقت الإجابة', type: 'datetime', width: 18 },
    ],
    filters: [
      { key: 'courseId', label: 'الكورس', type: 'course' },
      { key: 'groupId', label: 'المجموعة', type: 'group' },
    ],
    resolveColumns: (params) => {
      // Per-student export: the identity fields move to the workbook report
      // info block (see buildInfo) instead of repeating in every row.
      if (!params.studentId) {
        return EXPORT_DATASETS.find((d) => d.key === 'survey_results')!.columns;
      }
      return EXPORT_DATASETS
        .find((d) => d.key === 'survey_results')!
        .columns.filter((c) => !['course', 'group_name', 'student', 'anonymous'].includes(c.key));
    },
    build: (params) => {
      const args: unknown[] = [];
      let where = "s.status = 'submitted'";
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      if (params.groupId) {
        where += ' AND s.group_id = ?';
        args.push(params.groupId);
      }
      if (params.studentId) {
        // Anonymity rule: an anonymous response is never attributed or
        // searched, so a per-student export only ever matches a named one.
        where += ' AND s.user_id = ? AND s.is_anonymous = 0';
        args.push(params.studentId);
      }
      return {
        text: `SELECT c.title_ar AS course, g.name AS group_name,
                 CASE WHEN s.is_anonymous = 1 THEN 'مجهول' ELSE u.name END AS student,
                 CASE WHEN s.is_anonymous = 1 THEN 1 ELSE 0 END AS anonymous,
                 CAST(json_extract(s.answers,'$.lecturer_knowledge') AS REAL) AS lecturer_knowledge,
                 CAST(json_extract(s.answers,'$.lecturer_communication') AS REAL) AS lecturer_communication,
                 CAST(json_extract(s.answers,'$.lecturer_organization') AS REAL) AS lecturer_organization,
                 CAST(json_extract(s.answers,'$.lecturer_cooperation') AS REAL) AS lecturer_cooperation,
                 CAST(json_extract(s.answers,'$.lecturer_motivation') AS REAL) AS lecturer_motivation,
                 CAST(json_extract(s.answers,'$.program_content') AS REAL) AS program_content,
                 CAST(json_extract(s.answers,'$.program_materials') AS REAL) AS program_materials,
                 CAST(json_extract(s.answers,'$.program_material_organization') AS REAL) AS program_material_organization,
                 CAST(json_extract(s.answers,'$.program_goals') AS REAL) AS program_goals,
                 CAST(json_extract(s.answers,'$.program_organization') AS REAL) AS program_organization,
                 CAST(json_extract(s.answers,'$.program_duration') AS REAL) AS program_duration,
                 CAST(json_extract(s.answers,'$.program_place') AS REAL) AS program_place,
                 CASE json_extract(s.answers,'$.helped_develop')
                   WHEN 'yes' THEN 'نعم' WHEN 'no' THEN 'لا' ELSE '' END AS helped_develop,
                 s.submitted_at
               FROM group_surveys s
               JOIN users u ON s.user_id = u.id
               JOIN groups g ON s.group_id = g.id
               JOIN courses c ON g.course_id = c.id
               WHERE ${where} ORDER BY c.title_ar ASC, g.name ASC, s.submitted_at ASC`,
        args,
      };
    },
    buildInfo: async (params, rows) => {
      // Report info block for the per-student export (identity fields are
      // derived from the exported rows, which are guaranteed named here).
      if (!params.studentId || rows.length === 0) return undefined;
      const row = rows[0] as any;
      return [
        { label: 'الطالب', value: String(row.student || '—') },
        { label: 'الكورس', value: String(row.course || '—') },
        { label: 'المجموعة', value: String(row.group_name || '—') },
        {
          label: 'وقت التسليم',
          value: formatCairoFromRaw(row.submitted_at),
        },
      ];
    },
    buildNote: async (params) => {
      try {
        if (params.groupId) {
          const { getGroupSurveyStats } = await import('./surveyService');
          const stats = await getGroupSurveyStats(params.groupId);
          const averages = (stats.items as any[])
            .filter((item) => item.avg != null)
            .map((item) => `${item.label}: ${item.avg}`);
          const parts = [
            `عدد من أجابوا: ${stats.answered} من ${stats.total_students} (${stats.response_rate}%)`,
            stats.overall_avg != null ? `المتوسط العام: ${stats.overall_avg} / 5` : '',
            averages.length ? `متوسطات البنود — ${averages.join(' | ')}` : '',
          ].filter(Boolean);
          return parts.join('   •   ');
        }
        const noteArgs: unknown[] = [];
        let noteWhere = "s.status = 'submitted'";
        if (params.courseId) {
          noteWhere += ' AND g.course_id = ?';
          noteArgs.push(params.courseId);
        }
        const result = await sql(
          `SELECT COUNT(*) AS answered
           FROM group_surveys s JOIN groups g ON s.group_id = g.id
           WHERE ${noteWhere}`,
          ...noteArgs,
        );
        const row = result.rows[0] as any;
        return `عدد الردود المسجلة: ${Number(row?.answered || 0)}`;
      } catch {
        return undefined;
      }
    },
  },
  {
    key: 'instructor_eval',
    section: 'groups',
    name: 'تقييم المحاضر للطلاب',
    description: 'درجات أسئلة تقييم المحاضر للطلاب الأربعة والمجموع لكل طالب.',
    icon: '🧑‍🏫',
    columns: [
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'group_name', header: 'المجموعة', type: 'text' },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'commitment', header: 'الالتزام بالقواعد', type: 'number', width: 16 },
      { key: 'attendance', header: 'التواجد والحرص', type: 'number', width: 16 },
      { key: 'conduct', header: 'التعامل اللائق', type: 'number', width: 15 },
      { key: 'participation', header: 'المشاركة الإيجابية', type: 'number', width: 16 },
      { key: 'total', header: 'المجموع', type: 'number', width: 12, total: 'sum' },
      { key: 'eval_status', header: 'حالة التقييم', type: 'text', width: 14, badge: EVAL_STATUS_BADGE },
      { key: 'submitted_at', header: 'وقت الإرسال', type: 'datetime', width: 18 },
    ],
    filters: [
      { key: 'courseId', label: 'الكورس', type: 'course' },
      { key: 'groupId', label: 'المجموعة', type: 'group' },
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      if (params.groupId) {
        where += ' AND g.id = ?';
        args.push(params.groupId);
      }
      return {
        text: `SELECT c.title_ar AS course, g.name AS group_name, u.name AS student,
                 CAST(json_extract(sc.scores,'$[0]') AS REAL) AS commitment,
                 CAST(json_extract(sc.scores,'$[1]') AS REAL) AS attendance,
                 CAST(json_extract(sc.scores,'$[2]') AS REAL) AS conduct,
                 CAST(json_extract(sc.scores,'$[3]') AS REAL) AS participation,
                 sc.total, e.status AS eval_status, e.submitted_at
               FROM group_instructor_evals e
               JOIN groups g ON e.group_id = g.id
               JOIN courses c ON g.course_id = c.id
               JOIN group_instructor_eval_scores sc ON sc.eval_id = e.id
               JOIN users u ON sc.student_id = u.id
               WHERE ${where} ORDER BY c.title_ar ASC, g.name ASC, sc.total DESC, u.name ASC`,
        args,
      };
    },
    mapRow: (row) => ({ ...row, eval_status: translate(row.eval_status, EVAL_STATUS_LABELS) }),
  },
  {
    key: 'unassigned',
    section: 'students',
    name: 'طلاب لم يُسكَّنوا',
    description: 'الطلاب الذين دفعوا ولم يتم إضافتهم إلى أي مجموعة في الكورس.',
    icon: '⏳',
    columns: [
      { key: 'order_id', header: 'رقم الطلب', type: 'number', width: 12 },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'amount', header: 'المبلغ المدفوع', type: 'currency', width: 16, total: 'sum' },
      { key: 'paid_at', header: 'تاريخ الدفع', type: 'datetime', width: 18 },
    ],
    filters: [
      { key: 'courseId', label: 'الكورس', type: 'course' },
      SEARCH_FILTER('اسم الطالب / البريد'),
      ...RANGE_FILTERS,
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = "o.status = 'paid'";
      where += ` AND NOT EXISTS (
        SELECT 1 FROM group_students gs JOIN groups g ON gs.group_id = g.id
        WHERE gs.user_id = o.user_id AND g.course_id = oi.course_id
      )`;
      if (params.courseId) {
        where += ' AND oi.course_id = ?';
        args.push(params.courseId);
      }
      where += searchClause(['u.name', 'u.email'], params, args);
      where += dateClause('o.created_at', params, args);
      return {
        text: `SELECT o.id AS order_id, u.name AS student, u.email, u.phone, c.title_ar AS course,
                 oi.price AS amount, o.created_at AS paid_at
               FROM order_items oi
               JOIN orders o ON oi.order_id = o.id
               JOIN users u ON o.user_id = u.id
               JOIN courses c ON oi.course_id = c.id
               WHERE ${where} ORDER BY o.created_at DESC`,
        args,
      };
    },
  },
  {
    key: 'certificates',
    section: 'certificates',
    name: 'الشهادات',
    description: 'كل الشهادات الصادرة مع السيريال والحالة وتاريخ الإصدار.',
    icon: '🎓',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'serial_id', header: 'السيريال', type: 'text', width: 22 },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'status', header: 'الحالة', type: 'text', width: 12, badge: CERT_STATUS_BADGE },
      { key: 'issued_at', header: 'تاريخ الإصدار', type: 'datetime', width: 18 },
      { key: 'revoked_at', header: 'تاريخ السحب', type: 'datetime', width: 18 },
      { key: 'revoke_reason', header: 'سبب السحب', type: 'text', width: 28 },
    ],
    filters: [
      {
        key: 'status',
        label: 'حالة الشهادة',
        type: 'select',
        options: [
          { value: 'active', label: 'سارية' },
          { value: 'revoked', label: 'مسحوبة' },
        ],
      },
      { key: 'courseId', label: 'الكورس', type: 'course' },
      SEARCH_FILTER('اسم الطالب / السيريال'),
      ...RANGE_FILTERS,
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.status) {
        where += ' AND ce.status = ?';
        args.push(params.status);
      }
      if (params.courseId) {
        where += ' AND ce.course_id = ?';
        args.push(params.courseId);
      }
      if (params.studentId) {
        where += ' AND ce.user_id = ?';
        args.push(params.studentId);
      }
      where += searchClause(['u.name', 'u.email', 'ce.serial_id'], params, args);
      where += dateClause('ce.issued_at', params, args);
      return {
        text: `SELECT ce.id, ce.serial_id, u.name AS student, u.email, c.title_ar AS course,
                 ce.status, ce.issued_at, ce.revoked_at, ce.revoke_reason
               FROM certificates ce
               JOIN users u ON ce.user_id = u.id
               JOIN courses c ON ce.course_id = c.id
               WHERE ${where} ORDER BY ce.issued_at DESC`,
        args,
      };
    },
    mapRow: (row) => ({ ...row, status: translate(row.status, CERT_STATUS_LABELS) }),
  },
  {
    key: 'employees',
    section: 'employees',
    name: 'الموظفون',
    description: 'حسابات الموظفين وصلاحياتهم وحالتهم.',
    icon: '🔐',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'name', header: 'الاسم', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'is_active', header: 'الحالة', type: 'boolean', width: 10 },
      { key: 'created_at', header: 'تاريخ الإضافة', type: 'date', width: 16 },
    ],
    filters: [SEARCH_FILTER('اسم / بريد'), ACTIVE_FILTER, ...RANGE_FILTERS],
    build: (params) => {
      const args: unknown[] = [];
      let where = 'u.role_id = 2';
      where += searchClause(['u.name', 'u.email'], params, args);
      if (params.status === 'active') where += ' AND COALESCE(u.is_active,1) = 1';
      if (params.status === 'inactive') where += ' AND COALESCE(u.is_active,1) = 0';
      where += dateClause('u.created_at', params, args);
      return {
        text: `SELECT u.id, u.name, u.email, u.phone, u.created_at,
                 CASE WHEN COALESCE(u.is_active,1)=1 THEN 1 ELSE 0 END AS is_active
               FROM users u WHERE ${where} ORDER BY u.name ASC`,
        args,
      };
    },
  },
  {
    key: 'financials',
    section: 'financials',
    name: 'التقرير المالي',
    description: 'إيرادات شهرية مفصّلة حسب الكورس (الطلبات المدفوعة فقط).',
    icon: '💰',
    columns: [
      { key: 'month', header: 'الشهر', type: 'text', width: 14 },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'orders_count', header: 'عدد الطلبات', type: 'number', width: 14, total: 'sum' },
      { key: 'total_amount', header: 'الإيراد', type: 'currency', width: 18, total: 'sum' },
    ],
    filters: [
      { key: 'courseId', label: 'الكورس', type: 'course' },
      ...RANGE_FILTERS,
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = "o.status = 'paid'";
      if (params.courseId) {
        where += ' AND oi.course_id = ?';
        args.push(params.courseId);
      }
      where += dateClause('o.created_at', params, args);
      return {
        text: `SELECT strftime('%Y-%m', o.created_at) AS month, c.title_ar AS course,
                 COUNT(*) AS orders_count, SUM(oi.price) AS total_amount
               FROM order_items oi
               JOIN orders o ON oi.order_id = o.id
               JOIN courses c ON oi.course_id = c.id
               WHERE ${where}
               GROUP BY month, c.id ORDER BY month DESC, total_amount DESC`,
        args,
      };
    },
  },
  {
    key: 'notifications',
    section: 'settings',
    name: 'الإشعارات',
    description: 'سجل الإشعارات المُرسلة داخل المنصة لكل مستخدم.',
    icon: '🔔',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'user_name', header: 'المستخدم', type: 'text' },
      { key: 'email', header: 'البريد الإلكتروني', type: 'text' },
      { key: 'title', header: 'العنوان', type: 'text' },
      { key: 'message', header: 'النص', type: 'text', width: 40 },
      { key: 'type', header: 'النوع', type: 'text', width: 12 },
      { key: 'is_read', header: 'مقروء', type: 'boolean', width: 10 },
      { key: 'created_at', header: 'التاريخ', type: 'datetime', width: 18 },
    ],
    filters: [
      {
        key: 'status',
        label: 'الحالة',
        type: 'select',
        options: [
          { value: 'read', label: 'مقروء' },
          { value: 'unread', label: 'غير مقروء' },
        ],
      },
      SEARCH_FILTER('اسم المستخدم / العنوان'),
      ...RANGE_FILTERS,
    ],
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.status === 'read') where += ' AND n.is_read = 1';
      if (params.status === 'unread') where += ' AND n.is_read = 0';
      where += searchClause(['u.name', 'n.title'], params, args);
      where += dateClause('n.created_at', params, args);
      return {
        text: `SELECT n.id, u.name AS user_name, u.email, n.title, n.message, n.type, n.is_read, n.created_at
               FROM notifications n JOIN users u ON n.user_id = u.id
               WHERE ${where} ORDER BY n.created_at DESC`,
        args,
      };
    },
    mapRow: (row) => ({ ...row, type: translate(row.type, NOTIFICATION_TYPE_LABELS) }),
  },
];

export function findDataset(key: string): ExportDataset | undefined {
  return EXPORT_DATASETS.find((dataset) => dataset.key === key);
}

export async function runDataset(
  dataset: ExportDataset,
  params: ExportParams,
): Promise<Record<string, unknown>[]> {
  const { text, args } = dataset.build(params);
  const result = await sql(text, ...args);
  const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 50_000) : 50_000;
  const rows = result.rows.slice(0, limit) as Record<string, unknown>[];
  return dataset.mapRow ? rows.map(dataset.mapRow) : rows;
}

/**
 * Build per-group matrix sheets for the XLSX attendance export (D2, D3, D4, A2).
 * Each group becomes one worksheet with one row per distinct student, one column
 * per lecture ordered by date, live COUNTIF totals with precomputed results, and
 * a clear empty message if a group has no students or no lectures.
 */
export async function buildAttendanceMatrixSheets(
  params: ExportParams,
  requestedColumns: string[],
  filters: { label: string; value: string }[],
): Promise<SheetBuildOptions[]> {
  const scopeWhereParts: string[] = ['1=1'];
  const scopeArgs: unknown[] = [];
  if (params.courseId) {
    scopeWhereParts.push('g.course_id = ?');
    scopeArgs.push(params.courseId);
  }
  if (params.groupId) {
    scopeWhereParts.push('g.id = ?');
    scopeArgs.push(params.groupId);
  }
  const scopeWhere = scopeWhereParts.join(' AND ');

  const groupsRes = await sql(
    `SELECT g.id, g.name AS group_name, g.instructor_name, g.location,
            p.name AS place_name, c.id AS course_id, c.title_ar AS course, c.course_mode
     FROM groups g
     JOIN courses c ON c.id = g.course_id
     LEFT JOIN places p ON p.id = g.place_id
     WHERE ${scopeWhere}
     ORDER BY c.title_ar ASC, g.name ASC, g.id ASC`,
    ...scopeArgs,
  );

  const groups = groupsRes.rows as Record<string, any>[];
  if (groups.length === 0) return [];

  // Lectures matching scope + date filter
  const lecArgs = [...scopeArgs];
  let lecWhere = scopeWhere + dateClause('l.date', params, lecArgs);
  const lecRes = await sql(
    `SELECT l.id, l.group_id, l.date, l.topic, l.is_completed, l.sort_order,
            EXISTS (SELECT 1 FROM lecture_attendance a2 WHERE a2.lecture_id = l.id AND a2.attended = 1) AS has_attendance
     FROM lectures l
     JOIN groups g ON g.id = l.group_id
     WHERE ${lecWhere}
     ORDER BY l.group_id ASC, l.date ASC, l.sort_order ASC, l.id ASC`,
    ...lecArgs,
  );

  // Distinct students per group matching scope + search filter
  const stuArgs = [...scopeArgs];
  const stuWhere = scopeWhere + searchClause(['u.name', 'u.phone'], params, stuArgs);
  const stuRes = await sql(
    `SELECT DISTINCT gs.group_id, u.id AS student_id, u.name AS student, u.phone
     FROM group_students gs
     JOIN groups g ON g.id = gs.group_id
     JOIN users u ON u.id = gs.user_id
     WHERE ${stuWhere}
     ORDER BY u.name ASC, u.id ASC`,
    ...stuArgs,
  );

  // Attended pairs for matching scope
  const attRes = await sql(
    `SELECT la.lecture_id, la.user_id
     FROM lecture_attendance la
     JOIN lectures l ON l.id = la.lecture_id
     JOIN groups g ON g.id = l.group_id
     WHERE ${scopeWhere} AND la.attended = 1`,
    ...scopeArgs,
  );

  const lecturesByGroup = new Map<number, Record<string, any>[]>();
  for (const l of lecRes.rows as Record<string, any>[]) {
    const gid = Number(l.group_id);
    const arr = lecturesByGroup.get(gid) ?? [];
    arr.push(l);
    lecturesByGroup.set(gid, arr);
  }

  const studentsByGroup = new Map<number, Record<string, any>[]>();
  const seenStudent = new Set<string>();
  for (const s of stuRes.rows as Record<string, any>[]) {
    const gid = Number(s.group_id);
    const sid = Number(s.student_id);
    const key = `${gid}:${sid}`;
    if (seenStudent.has(key)) continue;
    seenStudent.add(key);
    const arr = studentsByGroup.get(gid) ?? [];
    arr.push(s);
    studentsByGroup.set(gid, arr);
  }

  const attendedSet = new Set<string>();
  for (const a of attRes.rows as Record<string, any>[]) {
    attendedSet.add(`${Number(a.lecture_id)}:${Number(a.user_id)}`);
  }

  const todayCairo = formatCairoDateTime(new Date()).slice(0, 10);

  // Determine which fixed leading columns to include (columns= affects fixed columns only)
  const baseFixedColumns: ExportColumn[] = [
    { key: 'id', header: '#', type: 'number', width: 7 },
    { key: 'student', header: 'الطالب', type: 'text', width: 24 },
    { key: 'phone', header: 'الهاتف', type: 'text', width: 15 },
  ];
  let fixedColumns = baseFixedColumns;
  if (requestedColumns.length > 0) {
    const picked = baseFixedColumns.filter((c) => requestedColumns.includes(c.key));
    fixedColumns = picked.length > 0 ? picked : [baseFixedColumns[1]];
  }

  return groups.map((group) => {
    const gid = Number(group.id);
    const groupLectures = lecturesByGroup.get(gid) ?? [];
    const groupStudents = studentsByGroup.get(gid) ?? [];

    const heldCount = groupLectures.filter(
      (l) => Number(l.is_completed) === 1 || Number(l.has_attendance) === 1,
    ).length;

    const lectureColumns: ExportColumn[] = groupLectures.map((l, idx) => {
      const dm = l.date ? formatDayMonth(String(l.date)) : `#${idx + 1}`;
      const topic = l.topic ? String(l.topic).trim() : '';
      const header = topic ? `${dm}\n${topic}` : dm;
      const maxLine = Math.max(dm.length, Math.min(20, topic.length));
      return {
        key: `lec_${l.id}`,
        header,
        type: 'text',
        width: Math.max(13, Math.min(20, maxLine + 3)),
        badge: MATRIX_CELL_BADGE,
      };
    });

    const firstLecKey = lectureColumns[0]?.key;
    const lastLecKey = lectureColumns[lectureColumns.length - 1]?.key;

    const summaryColumns: ExportColumn[] =
      groupLectures.length > 0
        ? [
            {
              key: 'present_count',
              header: 'الحضور',
              type: 'number',
              width: 10,
              total: 'sum',
              formula: ({ rowNumber, record, colLetter }) => ({
                formula: `COUNTIF(${colLetter(firstLecKey!)}${rowNumber}:${colLetter(lastLecKey!)}${rowNumber},"✓ حضر")`,
                result: Number(record.present_count ?? 0),
              }),
            },
            {
              key: 'absent_count',
              header: 'الغياب',
              type: 'number',
              width: 10,
              total: 'sum',
              formula: ({ rowNumber, record, colLetter }) => ({
                formula: `COUNTIF(${colLetter(firstLecKey!)}${rowNumber}:${colLetter(lastLecKey!)}${rowNumber},"✗ غاب")`,
                result: Number(record.absent_count ?? 0),
              }),
            },
            {
              key: 'rate',
              header: 'نسبة الحضور',
              type: 'percent',
              width: 13,
              formula: ({ rowNumber, record, colLetter }) => {
                const pCol = colLetter('present_count');
                const aCol = colLetter('absent_count');
                const p = Number(record.present_count ?? 0);
                const a = Number(record.absent_count ?? 0);
                return {
                  formula: `IF((${pCol}${rowNumber}+${aCol}${rowNumber})=0,"—",${pCol}${rowNumber}/(${pCol}${rowNumber}+${aCol}${rowNumber}))`,
                  result: p + a === 0 ? '—' : p / (p + a),
                };
              },
              totalFormula: ({ totalsRowNumber, rows, colLetter }) => {
                const pCol = colLetter('present_count');
                const aCol = colLetter('absent_count');
                const tp = rows.reduce((s, r) => s + Number(r.present_count ?? 0), 0);
                const ta = rows.reduce((s, r) => s + Number(r.absent_count ?? 0), 0);
                return {
                  formula: `IF((${pCol}${totalsRowNumber}+${aCol}${totalsRowNumber})=0,"—",${pCol}${totalsRowNumber}/(${pCol}${totalsRowNumber}+${aCol}${totalsRowNumber}))`,
                  result: tp + ta === 0 ? '—' : tp / (tp + ta),
                };
              },
            },
          ]
        : [
            { key: 'present_count', header: 'الحضور', type: 'number', width: 10 },
            { key: 'absent_count', header: 'الغياب', type: 'number', width: 10 },
            { key: 'rate', header: 'نسبة الحضور', type: 'percent', width: 13 },
          ];

    const columns: ExportColumn[] = [...fixedColumns, ...lectureColumns, ...summaryColumns];

    let totalPresent = 0;
    let totalAbsent = 0;
    const rows: Record<string, unknown>[] =
      groupStudents.length > 0 && groupLectures.length > 0
        ? groupStudents.map((stu, idx) => {
            const sid = Number(stu.student_id);
            const row: Record<string, unknown> = {
              id: idx + 1,
              student: stu.student || '—',
              phone: stu.phone || '—',
            };
            let present = 0;
            let absent = 0;
            for (const l of groupLectures) {
              const lid = Number(l.id);
              const state = resolveAttendanceState({
                attended: attendedSet.has(`${lid}:${sid}`) ? 1 : 0,
                isCompleted: l.is_completed,
                hasAnyAttendance: l.has_attendance,
                lectureDate: l.date,
                todayCairo,
              });
              row[`lec_${lid}`] = ATTENDANCE_STATE_LABELS[state];
              if (state === 'attended') present += 1;
              else if (state === 'absent') absent += 1;
            }
            row.present_count = present;
            row.absent_count = absent;
            row.rate = present + absent === 0 ? '—' : present / (present + absent);
            totalPresent += present;
            totalAbsent += absent;
            return row;
          })
        : [];

    const dates = [...new Set(groupLectures.map((l) => String(l.date ?? '')).filter(Boolean))].sort();
    const datesText =
      dates.length === 0
        ? '—'
        : dates.length === 1
          ? formatDateShort(dates[0])
          : dates.length <= 3
            ? dates.map(formatDateShort).join('، ')
            : `من ${formatDateShort(dates[0])} إلى ${formatDateShort(dates[dates.length - 1])} (${dates.length} محاضرات)`;

    const place =
      group.course_mode !== 'offline' ? 'أونلاين' : group.place_name || group.location || '—';
    const avgRate =
      totalPresent + totalAbsent === 0
        ? '—'
        : `${((totalPresent / (totalPresent + totalAbsent)) * 100).toFixed(1)}%`;

    const infoBlock: { label: string; value: string }[] = [
      { label: 'الكورس', value: String(group.course || '—') },
      { label: 'المجموعة', value: String(group.group_name || '—') },
      { label: 'المحاضر', value: String(group.instructor_name || '—') },
      { label: 'المكان', value: place },
      { label: 'عدد الطلاب', value: String(groupStudents.length) },
      { label: 'المحاضرات المعقودة / الكلية', value: `${heldCount} / ${groupLectures.length}` },
      { label: 'متوسط الحضور', value: avgRate },
      { label: 'تواريخ المحاضرات', value: datesText },
    ];

    const emptyMessage =
      groupStudents.length === 0
        ? params.search
          ? 'لا يوجد طلاب مطابقون للبحث في هذه المجموعة'
          : 'لا يوجد طلاب مسجَّلون في هذه المجموعة'
        : 'لا توجد محاضرات مسجَّلة لهذه المجموعة';

    const rawSheetName =
      !params.courseId && !params.groupId
        ? `${group.group_name || 'مجموعة'} - ${group.course || ''}`
        : String(group.group_name || 'المجموعة');

    return {
      sheetName: rawSheetName,
      title: `كشف حضور: ${group.group_name || ''}`.trim(),
      description: 'كشف حضور الطلاب حسب المحاضرات (صف لكل طالب).',
      columns,
      rows,
      filters,
      infoBlock,
      footerNote: ATTENDANCE_LEGEND_NOTE,
      emptyMessage,
      showInstructorSignature: true,
      instructorName: group.instructor_name ? String(group.instructor_name) : undefined,
    };
  });
}
