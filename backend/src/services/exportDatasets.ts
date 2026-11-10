import { sql } from '../db/helpers';
import type { ExportColumn } from './excelExportService';

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
  /** Optional extra footer line (aggregates that do not fit a row, e.g. survey averages). */
  buildNote?: (params: ExportParams) => Promise<string | undefined>;
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
      { key: 'status', header: 'الحالة', type: 'text', width: 14 },
      { key: 'payment_method', header: 'طريقة الدفع', type: 'text', width: 14 },
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
      { key: 'status', header: 'الحالة', type: 'text', width: 12 },
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
    description: 'حضور كل طالب في كل محاضرة مع طريقة التحقق والوقت.',
    icon: '✅',
    columns: [
      { key: 'id', header: '#', type: 'number', width: 8 },
      { key: 'student', header: 'الطالب', type: 'text' },
      { key: 'phone', header: 'الهاتف', type: 'text', width: 16 },
      { key: 'course', header: 'الكورس', type: 'text' },
      { key: 'group_name', header: 'المجموعة', type: 'text' },
      { key: 'lecture_date', header: 'تاريخ المحاضرة', type: 'date', width: 15 },
      { key: 'topic', header: 'الموضوع', type: 'text', width: 26 },
      { key: 'attended', header: 'حضر؟', type: 'boolean', width: 10 },
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
    build: (params) => {
      const args: unknown[] = [];
      let where = '1=1';
      if (params.status === 'attended') where += ' AND a.attended = 1';
      if (params.status === 'absent') where += ' AND a.attended = 0';
      if (params.courseId) {
        where += ' AND g.course_id = ?';
        args.push(params.courseId);
      }
      if (params.groupId) {
        where += ' AND l.group_id = ?';
        args.push(params.groupId);
      }
      if (params.studentId) {
        where += ' AND a.user_id = ?';
        args.push(params.studentId);
      }
      if (params.lectureId) {
        where += ' AND a.lecture_id = ?';
        args.push(params.lectureId);
      }
      where += searchClause(['u.name', 'u.phone'], params, args);
      where += dateClause('l.date', params, args);
      return {
        text: `SELECT a.id, u.name AS student, u.phone, c.title_ar AS course, g.name AS group_name,
                 l.date AS lecture_date, l.topic, a.attended, a.verification_method, a.attended_at
               FROM lecture_attendance a
               JOIN lectures l ON a.lecture_id = l.id
               JOIN groups g ON l.group_id = g.id
               JOIN courses c ON g.course_id = c.id
               JOIN users u ON a.user_id = u.id
               WHERE ${where} ORDER BY l.date DESC, u.name ASC`,
        args,
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
      { key: 'status', header: 'حالة المجموعة', type: 'text', width: 14 },
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
      { key: 'group_status', header: 'حالة المجموعة', type: 'text', width: 14 },
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
      { key: 'eval_status', header: 'حالة التقييم', type: 'text', width: 13 },
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
      { key: 'status', header: 'الحالة', type: 'text', width: 12 },
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
  return result.rows.slice(0, limit) as Record<string, unknown>[];
}
