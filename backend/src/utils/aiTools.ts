import { sql } from '../db/helpers';

interface ToolHandler {
  declaration: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  handler: (args: any, userId: number, roleId: number) => Promise<string>;
}

const tools: Record<string, ToolHandler> = {};

function reg(t: ToolHandler) {
  tools[t.declaration.name] = t;
}

// ─── Courses (6) ────────────────────────────────────────

reg({
  declaration: {
    name: 'get_course_stats',
    description: 'إحصائيات عامة عن الكورسات (عدد الكورسات، إجمالي الطلاب المسجلين، الإيرادات لكل كورس)',
    parameters: { type: 'object', properties: {} },
  },
  handler: async (_a, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك بعرض إحصائيات الكورسات';
    const rows = await sql(`SELECT c.id, c.title_ar, COUNT(o.id) as students, COALESCE(SUM(o.amount),0) as revenue
      FROM courses c LEFT JOIN orders o ON c.id=o.course_id AND o.status='paid'
      GROUP BY c.id ORDER BY revenue DESC`);
    const total = await sql(`SELECT COUNT(*) as count FROM courses WHERE is_active=1`);
    return JSON.stringify({ totalCourses: total.rows[0].count, courses: rows.rows });
  },
});

reg({
  declaration: {
    name: 'get_all_courses',
    description: 'عرض جميع الكورسات مع إمكانية التصفية حسب التصنيف أو حالة التفعيل',
    parameters: {
      type: 'object',
      properties: {
        category_id: { type: 'number', description: 'فلتر حسب تصنيف معين (اختياري)' },
        is_active: { type: 'number', description: 'فلتر حسب التفعيل: 1=نشط, 0=غير نشط (اختياري)' },
        limit: { type: 'number', description: 'عدد النتائج (الافتراضي 50)', default: 50 },
      },
    },
  },
  handler: async (args) => {
    const filters: string[] = [];
    if (args.category_id) filters.push(`c.category_id=${Number(args.category_id)}`);
    if (args.is_active !== undefined) filters.push(`c.is_active=${Number(args.is_active)}`);
    const where = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
    const limit = Math.min(args.limit || 50, 200);
    const rows = await sql(`SELECT c.*, cat.name_ar as category_name
      FROM courses c LEFT JOIN categories cat ON c.category_id=cat.id
      ${where} ORDER BY c.created_at DESC LIMIT ${limit}`);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'search_courses',
    description: 'البحث في الكورسات بالاسم العربي أو الإنجليزي',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'نص البحث' },
      },
      required: ['query'],
    },
  },
  handler: async (args) => {
    const q = `%${args.query}%`;
    const rows = await sql(`SELECT c.*, cat.name_ar as category_name
      FROM courses c LEFT JOIN categories cat ON c.category_id=cat.id
      WHERE c.title_ar LIKE ? OR c.title_en LIKE ? OR c.description LIKE ?
      ORDER BY c.created_at DESC LIMIT 20`, q, q, q);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_course_by_id',
    description: 'عرض تفاصيل كورس محدد',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'رقم الكورس' },
      },
      required: ['id'],
    },
  },
  handler: async (args) => {
    const rows = await sql(`SELECT c.*, cat.name_ar as category_name
      FROM courses c LEFT JOIN categories cat ON c.category_id=cat.id WHERE c.id=?`, args.id);
    if (rows.rows.length === 0) return 'لم يتم العثور على الكورس';
    return JSON.stringify(rows.rows[0]);
  },
});

reg({
  declaration: {
    name: 'add_course',
    description: 'إضافة كورس جديد (للمشرف أو الموظف)',
    parameters: {
      type: 'object',
      properties: {
        title_ar: { type: 'string', description: 'اسم الكورس بالعربية' },
        title_en: { type: 'string', description: 'اسم الكورس بالإنجليزية' },
        description: { type: 'string', description: 'وصف الكورس' },
        price: { type: 'number', description: 'السعر' },
        category_id: { type: 'number', description: 'رقم التصنيف' },
        instructor: { type: 'string', description: 'اسم المدرب' },
        max_students: { type: 'number', description: 'الحد الأقصى للطلاب' },
      },
      required: ['title_ar', 'price'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك بإضافة كورسات';
    const r = await sql(`INSERT INTO courses (title_ar,title_en,description,price,category_id,instructor,max_students)
      VALUES (?,?,?,?,?,?,?)`,
      args.title_ar, args.title_en || '', args.description || '', args.price,
      args.category_id || null, args.instructor || '', args.max_students || 0);
    const id = r.lastInsertRowid?.toString();
    return JSON.stringify({ message: 'تم إضافة الكورس بنجاح', id: Number(id) });
  },
});

reg({
  declaration: {
    name: 'update_course',
    description: 'تعديل بيانات كورس (للمشرف أو الموظف)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'رقم الكورس' },
        title_ar: { type: 'string', description: 'الاسم بالعربية' },
        title_en: { type: 'string', description: 'الاسم بالإنجليزية' },
        description: { type: 'string', description: 'الوصف' },
        price: { type: 'number', description: 'السعر' },
        is_active: { type: 'number', description: '1=نشط, 0=غير نشط' },
        featured: { type: 'number', description: '1=مميز, 0=عادي' },
      },
      required: ['id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك بتعديل الكورسات';
    const fields: string[] = [];
    const vals: any[] = [];
    for (const key of ['title_ar', 'title_en', 'description', 'price', 'is_active', 'featured']) {
      if (args[key] !== undefined) { fields.push(`${key}=?`); vals.push(args[key]); }
    }
    if (fields.length === 0) return 'لا توجد بيانات للتعديل';
    vals.push(args.id);
    await sql(`UPDATE courses SET ${fields.join(', ')} WHERE id=?`, ...vals);
    return JSON.stringify({ message: 'تم تعديل الكورس بنجاح' });
  },
});

// ─── Categories (3) ─────────────────────────────────────

reg({
  declaration: {
    name: 'get_categories',
    description: 'عرض جميع التصنيفات',
    parameters: { type: 'object', properties: {} },
  },
  handler: async () => {
    const rows = await sql('SELECT * FROM categories ORDER BY name_ar');
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'add_category',
    description: 'إضافة تصنيف جديد',
    parameters: {
      type: 'object',
      properties: {
        name_ar: { type: 'string', description: 'اسم التصنيف بالعربية' },
        name_en: { type: 'string', description: 'اسم التصنيف بالإنجليزية' },
      },
      required: ['name_ar'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك بإضافة تصنيفات';
    await sql("INSERT INTO categories (name_ar,name_en) VALUES (?,?)", args.name_ar, args.name_en || '');
    return JSON.stringify({ message: 'تم إضافة التصنيف بنجاح' });
  },
});

reg({
  declaration: {
    name: 'delete_category',
    description: 'حذف تصنيف',
    parameters: {
      type: 'object',
      properties: { id: { type: 'number', description: 'رقم التصنيف' } },
      required: ['id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 1) return 'غير مصرح لك بحذف التصنيفات';
    await sql('DELETE FROM categories WHERE id=?', args.id);
    return JSON.stringify({ message: 'تم حذف التصنيف بنجاح' });
  },
});

// ─── Orders (6) ─────────────────────────────────────────

reg({
  declaration: {
    name: 'get_all_orders',
    description: 'عرض جميع الطلبات مع إمكانية التصفية حسب الحالة أو التاريخ',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['pending', 'review', 'paid', 'cancelled'], description: 'فلتر حسب الحالة (اختياري)' },
        limit: { type: 'number', description: 'عدد النتائج (الافتراضي 50)', default: 50 },
      },
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const where = args.status && args.status !== 'all' ? `WHERE o.status='${args.status}'` : '';
    const limit = Math.min(args.limit || 50, 200);
    const rows = await sql(`SELECT o.*, u.name as student_name, c.title_ar as course_name
      FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id
      ${where} ORDER BY o.created_at DESC LIMIT ${limit}`);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_order_by_id',
    description: 'عرض تفاصيل طلب محدد',
    parameters: {
      type: 'object',
      properties: { id: { type: 'number', description: 'رقم الطلب' } },
      required: ['id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const rows = await sql(`SELECT o.*, u.name as student_name, u.email, u.phone, c.title_ar as course_name
      FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id WHERE o.id=?`, args.id);
    if (rows.rows.length === 0) return 'لم يتم العثور على الطلب';
    return JSON.stringify(rows.rows[0]);
  },
});

reg({
  declaration: {
    name: 'get_my_orders',
    description: 'عرض طلبات المستخدم الحالي (خاص بالطلاب)',
    parameters: { type: 'object', properties: {} },
  },
  handler: async (_a, userId, roleId) => {
    if (roleId === 3) {
      const rows = await sql(`SELECT o.*, c.title_ar FROM orders o JOIN courses c ON o.course_id=c.id WHERE o.user_id=?`, userId);
      if (rows.rows.length === 0) return 'لا توجد طلبات';
      return JSON.stringify(rows.rows);
    }
    return 'هذه الأداة خاصة بالطلاب. استخدم get_all_orders لعرض جميع الطلبات.';
  },
});

reg({
  declaration: {
    name: 'create_order',
    description: 'إنشاء طلب جديد لطالب (للمشرف أو الموظف)',
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'number', description: 'رقم الطالب' },
        course_id: { type: 'number', description: 'رقم الكورس' },
        amount: { type: 'number', description: 'المبلغ' },
        status: { type: 'string', enum: ['pending', 'paid'], description: 'حالة الطلب', default: 'paid' },
        notes: { type: 'string', description: 'ملاحظات' },
      },
      required: ['user_id', 'course_id', 'amount'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك بإنشاء طلبات';
    const r = await sql(`INSERT INTO orders (user_id,course_id,amount,status,notes,verified_by,verified_at)
      VALUES (?,?,?,?,?,?,CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE NULL END)`,
      args.user_id, args.course_id, args.amount, args.status || 'paid', args.notes || '', args.status === 'paid' ? 1 : null);
    return JSON.stringify({ message: 'تم إنشاء الطلب بنجاح', id: Number(r.lastInsertRowid?.toString()) });
  },
});

reg({
  declaration: {
    name: 'update_order_status',
    description: 'تحديث حالة طلب (معلق ← مراجعة ← مدفوع/ملغي)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'رقم الطلب' },
        status: { type: 'string', enum: ['pending', 'review', 'paid', 'cancelled'], description: 'الحالة الجديدة' },
      },
      required: ['id', 'status'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    await sql(`UPDATE orders SET status=?, verified_by=?, verified_at=CASE WHEN ?='paid' THEN CURRENT_TIMESTAMP ELSE verified_at END WHERE id=?`,
      args.status, 1, args.status, args.id);
    return JSON.stringify({ message: 'تم تحديث حالة الطلب بنجاح' });
  },
});

reg({
  declaration: {
    name: 'get_order_financials',
    description: 'ملخص مالي للإيرادات والمبيعات',
    parameters: { type: 'object', properties: {} },
  },
  handler: async (_a, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك بعرض المالية';
    const paid = await sql("SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM orders WHERE status='paid'");
    const pending = await sql("SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM orders WHERE status='pending'");
    const review = await sql("SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM orders WHERE status='review'");
    return JSON.stringify({
      paid: { count: paid.rows[0].count, total: paid.rows[0].total },
      pending: { count: pending.rows[0].count, total: pending.rows[0].total },
      review: { count: review.rows[0].count, total: review.rows[0].total },
    });
  },
});

// ─── Students/Users (5) ─────────────────────────────────

reg({
  declaration: {
    name: 'get_all_students',
    description: 'عرض جميع الطلاب (المستخدمين من دور طالب)',
    parameters: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'بحث بالاسم أو البريد (اختياري)' },
        limit: { type: 'number', description: 'عدد النتائج (الافتراضي 50)', default: 50 },
      },
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const where = args.search ? `WHERE (u.name LIKE ? OR u.email LIKE ?) AND u.role_id=3` : `WHERE u.role_id=3`;
    const limit = Math.min(args.limit || 50, 200);
    const rows = args.search
      ? await sql(`SELECT u.id,u.name,u.email,u.phone,u.is_active,u.created_at FROM users u ${where} ORDER BY u.name LIMIT ${limit}`, `%${args.search}%`, `%${args.search}%`)
      : await sql(`SELECT u.id,u.name,u.email,u.phone,u.is_active,u.created_at FROM users u ${where} ORDER BY u.name LIMIT ${limit}`);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_student_by_id',
    description: 'عرض تفاصيل طالب مع طلباته ومجموعاته',
    parameters: {
      type: 'object',
      properties: { id: { type: 'number', description: 'رقم الطالب' } },
      required: ['id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const user = await sql('SELECT id,name,email,phone,is_active,created_at FROM users WHERE id=?', args.id);
    if (user.rows.length === 0) return 'لم يتم العثور على الطالب';
    const orders = await sql(`SELECT o.*, c.title_ar FROM orders o JOIN courses c ON o.course_id=c.id WHERE o.user_id=?`, args.id);
    const groups = await sql(`SELECT g.id,g.name,g.start_date,g.end_date,c.title_ar as course_name
      FROM group_students gs JOIN groups g ON gs.group_id=g.id JOIN courses c ON g.course_id=c.id WHERE gs.user_id=?`, args.id);
    return JSON.stringify({ student: user.rows[0], orders: orders.rows, groups: groups.rows });
  },
});

reg({
  declaration: {
    name: 'get_student_orders',
    description: 'عرض طلبات طالب محدد',
    parameters: {
      type: 'object',
      properties: { user_id: { type: 'number', description: 'رقم الطالب' } },
      required: ['user_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const rows = await sql(`SELECT o.*, c.title_ar FROM orders o JOIN courses c ON o.course_id=c.id WHERE o.user_id=? ORDER BY o.created_at DESC`, args.user_id);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_student_groups',
    description: 'عرض المجموعات المسجل فيها طالب محدد',
    parameters: {
      type: 'object',
      properties: { user_id: { type: 'number', description: 'رقم الطالب' } },
      required: ['user_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const rows = await sql(`SELECT g.id,g.name,g.start_date,g.end_date,g.schedule,g.zoom_link,c.title_ar as course_name
      FROM group_students gs JOIN groups g ON gs.group_id=g.id JOIN courses c ON g.course_id=c.id WHERE gs.user_id=?`, args.user_id);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_student_certificates',
    description: 'عرض شهادات طالب محدد',
    parameters: {
      type: 'object',
      properties: { user_id: { type: 'number', description: 'رقم الطالب' } },
      required: ['user_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const rows = await sql(`SELECT cert.*, c.title_ar as course_name FROM certificates cert
      JOIN courses c ON cert.course_id=c.id WHERE cert.user_id=? ORDER BY cert.issued_at DESC`, args.user_id);
    return JSON.stringify(rows.rows);
  },
});

// ─── Groups (5) ─────────────────────────────────────────

reg({
  declaration: {
    name: 'get_all_groups',
    description: 'عرض جميع المجموعات الدراسية مع تفاصيل الكورس',
    parameters: {
      type: 'object',
      properties: {
        course_id: { type: 'number', description: 'فلتر حسب الكورس (اختياري)' },
        is_active: { type: 'number', description: 'فلتر حسب التفعيل (اختياري)' },
      },
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const filters: string[] = [];
    if (args.course_id) filters.push(`g.course_id=${Number(args.course_id)}`);
    if (args.is_active !== undefined) filters.push(`g.is_active=${Number(args.is_active)}`);
    const where = filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '';
    const rows = await sql(`SELECT g.*, c.title_ar as course_name,
      (SELECT COUNT(*) FROM group_students WHERE group_id=g.id) as student_count
      FROM groups g JOIN courses c ON g.course_id=c.id ${where} ORDER BY g.created_at DESC`);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_group_by_id',
    description: 'عرض تفاصيل مجموعة مع قائمة الطلاب',
    parameters: {
      type: 'object',
      properties: { id: { type: 'number', description: 'رقم المجموعة' } },
      required: ['id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const group = await sql(`SELECT g.*, c.title_ar as course_name FROM groups g JOIN courses c ON g.course_id=c.id WHERE g.id=?`, args.id);
    if (group.rows.length === 0) return 'لم يتم العثور على المجموعة';
    const students = await sql(`SELECT u.id,u.name,u.email,u.phone FROM group_students gs JOIN users u ON gs.user_id=u.id WHERE gs.group_id=?`, args.id);
    return JSON.stringify({ ...group.rows[0], students: students.rows });
  },
});

reg({
  declaration: {
    name: 'create_group',
    description: 'إنشاء مجموعة دراسية جديدة',
    parameters: {
      type: 'object',
      properties: {
        course_id: { type: 'number', description: 'رقم الكورس' },
        name: { type: 'string', description: 'اسم المجموعة' },
        start_date: { type: 'string', description: 'تاريخ البداية (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'تاريخ النهاية (YYYY-MM-DD)' },
        zoom_link: { type: 'string', description: 'رابط Zoom (اختياري)' },
        max_students: { type: 'number', description: 'الحد الأقصى للطلاب' },
      },
      required: ['course_id', 'name'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const r = await sql(`INSERT INTO groups (course_id,name,start_date,end_date,zoom_link,max_students)
      VALUES (?,?,?,?,?,?)`,
      args.course_id, args.name, args.start_date || null, args.end_date || null,
      args.zoom_link || '', args.max_students || 30);
    return JSON.stringify({ message: 'تم إنشاء المجموعة بنجاح', id: Number(r.lastInsertRowid?.toString()) });
  },
});

reg({
  declaration: {
    name: 'add_student_to_group',
    description: 'إضافة طالب إلى مجموعة دراسية',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'رقم المجموعة' },
        user_id: { type: 'number', description: 'رقم الطالب' },
      },
      required: ['group_id', 'user_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const exists = await sql(`SELECT * FROM group_students WHERE group_id=? AND user_id=?`, args.group_id, args.user_id);
    if (exists.rows.length > 0) return 'الطالب موجود بالفعل في هذه المجموعة';
    await sql('INSERT INTO group_students (group_id,user_id) VALUES (?,?)', args.group_id, args.user_id);
    return JSON.stringify({ message: 'تم إضافة الطالب إلى المجموعة بنجاح' });
  },
});

reg({
  declaration: {
    name: 'remove_student_from_group',
    description: 'إزالة طالب من مجموعة دراسية',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'رقم المجموعة' },
        user_id: { type: 'number', description: 'رقم الطالب' },
      },
      required: ['group_id', 'user_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    await sql('DELETE FROM group_students WHERE group_id=? AND user_id=?', args.group_id, args.user_id);
    return JSON.stringify({ message: 'تم إزالة الطالب من المجموعة بنجاح' });
  },
});

// ─── Lectures (4) ───────────────────────────────────────

reg({
  declaration: {
    name: 'get_group_lectures',
    description: 'عرض محاضرات مجموعة دراسية',
    parameters: {
      type: 'object',
      properties: { group_id: { type: 'number', description: 'رقم المجموعة' } },
      required: ['group_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    const rows = await sql(`SELECT * FROM lectures WHERE group_id=? ORDER BY sort_order, date`, args.group_id);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'create_lecture',
    description: 'إضافة محاضرة لمجموعة دراسية',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'رقم المجموعة' },
        day_of_week: { type: 'number', description: 'رقم اليوم (0=الأحد إلى 6=السبت)' },
        time_from: { type: 'string', description: 'وقت البداية (HH:MM)' },
        time_to: { type: 'string', description: 'وقت النهاية (HH:MM)' },
        topic: { type: 'string', description: 'الموضوع' },
        date: { type: 'string', description: 'التاريخ (YYYY-MM-DD)' },
      },
      required: ['group_id', 'day_of_week'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const r = await sql(`INSERT INTO lectures (group_id,day_of_week,time_from,time_to,topic,date)
      VALUES (?,?,?,?,?,?)`,
      args.group_id, args.day_of_week, args.time_from || '', args.time_to || '',
      args.topic || '', args.date || null);
    return JSON.stringify({ message: 'تم إضافة المحاضرة بنجاح', id: Number(r.lastInsertRowid?.toString()) });
  },
});

reg({
  declaration: {
    name: 'update_lecture',
    description: 'تعديل محاضرة',
    parameters: {
      type: 'object',
      properties: {
        group_id: { type: 'number', description: 'رقم المجموعة' },
        lecture_id: { type: 'number', description: 'رقم المحاضرة' },
        topic: { type: 'string', description: 'الموضوع' },
        time_from: { type: 'string', description: 'وقت البداية (HH:MM)' },
        time_to: { type: 'string', description: 'وقت النهاية (HH:MM)' },
        date: { type: 'string', description: 'التاريخ (YYYY-MM-DD)' },
      },
      required: ['group_id', 'lecture_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const fields: string[] = [];
    const vals: any[] = [];
    for (const key of ['topic', 'time_from', 'time_to', 'date']) {
      if (args[key] !== undefined) { fields.push(`${key}=?`); vals.push(args[key]); }
    }
    if (fields.length === 0) return 'لا توجد بيانات للتعديل';
    vals.push(args.lecture_id);
    await sql(`UPDATE lectures SET ${fields.join(', ')} WHERE id=?`, ...vals);
    return JSON.stringify({ message: 'تم تعديل المحاضرة بنجاح' });
  },
});

reg({
  declaration: {
    name: 'toggle_lecture_completion',
    description: 'تحديد اكتمال محاضرة أو إلغاء اكتمالها',
    parameters: {
      type: 'object',
      properties: {
        lecture_id: { type: 'number', description: 'رقم المحاضرة' },
        is_completed: { type: 'number', description: '1=مكتملة, 0=غير مكتملة' },
      },
      required: ['lecture_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const completed = args.is_completed !== undefined ? args.is_completed : 1;
    await sql(`UPDATE lectures SET is_completed=?, completed_at=CASE WHEN ?=1 THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?`,
      completed, completed, args.lecture_id);
    return JSON.stringify({ message: completed ? 'تم تحديد اكتمال المحاضرة' : 'تم إلغاء اكتمال المحاضرة' });
  },
});

// ─── Certificates (4) ───────────────────────────────────

reg({
  declaration: {
    name: 'get_all_certificates',
    description: 'عرض جميع الشهادات الصادرة',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'عدد النتائج (الافتراضي 50)', default: 50 },
      },
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const limit = Math.min(args.limit || 50, 200);
    const rows = await sql(`SELECT cert.*, u.name as student_name, c.title_ar as course_name
      FROM certificates cert JOIN users u ON cert.user_id=u.id JOIN courses c ON cert.course_id=c.id
      ORDER BY cert.issued_at DESC LIMIT ${limit}`);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'issue_certificate',
    description: 'إصدار شهادة لطالب في كورس محدد',
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'number', description: 'رقم الطالب' },
        course_id: { type: 'number', description: 'رقم الكورس' },
      },
      required: ['user_id', 'course_id'],
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك بإصدار شهادات';
    const exists = await sql(`SELECT * FROM certificates WHERE user_id=? AND course_id=?`, args.user_id, args.course_id);
    if (exists.rows.length > 0) return 'الشهادة موجودة بالفعل لهذا الطالب في هذا الكورس';
    const serial = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    await sql('INSERT INTO certificates (user_id,course_id,serial_id) VALUES (?,?,?)', args.user_id, args.course_id, serial);
    return JSON.stringify({ message: 'تم إصدار الشهادة بنجاح', serial });
  },
});

reg({
  declaration: {
    name: 'verify_certificate',
    description: 'التحقق من صحة شهادة برقم المسلسل',
    parameters: {
      type: 'object',
      properties: { serial: { type: 'string', description: 'رقم الشهادة المسلسل (serial_id)' } },
      required: ['serial'],
    },
  },
  handler: async (args) => {
    const rows = await sql(`SELECT cert.*, u.name as student_name, c.title_ar as course_name
      FROM certificates cert JOIN users u ON cert.user_id=u.id JOIN courses c ON cert.course_id=c.id
      WHERE cert.serial_id=?`, args.serial);
    if (rows.rows.length === 0) return JSON.stringify({ valid: false, message: 'شهادة غير صالحة' });
    return JSON.stringify({ valid: true, certificate: rows.rows[0] });
  },
});

reg({
  declaration: {
    name: 'get_eligible_students',
    description: 'عرض الطلاب المؤهلين للحصول على شهادة (لديهم طلب مدفوع ولا توجد شهادة بعد)',
    parameters: {
      type: 'object',
      properties: {
        course_id: { type: 'number', description: 'فلتر حسب الكورس (اختياري)' },
      },
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const where = args.course_id ? `AND o.course_id=${Number(args.course_id)}` : '';
    const rows = await sql(`SELECT DISTINCT u.id,u.name,u.email,c.title_ar as course_name,o.course_id
      FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id
      WHERE o.status='paid' AND NOT EXISTS (SELECT 1 FROM certificates cert WHERE cert.user_id=o.user_id AND cert.course_id=o.course_id) ${where}
      ORDER BY u.name`);
    return JSON.stringify(rows.rows);
  },
});

// ─── Financial/Reports (4) ──────────────────────────────

reg({
  declaration: {
    name: 'get_pending_orders_summary',
    description: 'ملخص الطلبات حسب الحالة (معلقة، قيد المراجعة، مدفوعة، ملغية)',
    parameters: { type: 'object', properties: {} },
  },
  handler: async (_a, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const pending = await sql("SELECT COUNT(*) as count FROM orders WHERE status='pending'");
    const review = await sql("SELECT COUNT(*) as count FROM orders WHERE status='review'");
    const paid = await sql("SELECT COUNT(*) as count FROM orders WHERE status='paid'");
    const cancelled = await sql("SELECT COUNT(*) as count FROM orders WHERE status='cancelled'");
    return JSON.stringify({
      pending: pending.rows[0].count,
      review: review.rows[0].count,
      paid: paid.rows[0].count,
      cancelled: cancelled.rows[0].count,
    });
  },
});

reg({
  declaration: {
    name: 'get_revenue_report',
    description: 'تقرير الإيرادات الشهرية',
    parameters: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'عدد الأشهر الماضية (الافتراضي 12)', default: 12 },
      },
    },
  },
  handler: async (args, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const months = Math.min(args.months || 12, 36);
    const rows = await sql(`SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as orders, COALESCE(SUM(amount),0) as revenue
      FROM orders WHERE status='paid' AND created_at >= date('now', '-${months} months')
      GROUP BY month ORDER BY month DESC`);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_low_enrollment_courses',
    description: 'عرض الكورسات ذات التسجيل المنخفض (أقل من 5 طلاب)',
    parameters: { type: 'object', properties: {} },
  },
  handler: async (_a, _u, roleId) => {
    if (roleId > 2) return 'غير مصرح لك';
    const rows = await sql(`SELECT c.id, c.title_ar, c.price, COUNT(o.id) as student_count, COALESCE(SUM(o.amount),0) as revenue
      FROM courses c LEFT JOIN orders o ON c.id=o.course_id AND o.status='paid'
      GROUP BY c.id HAVING student_count < 5 ORDER BY student_count`);
    return JSON.stringify(rows.rows);
  },
});

reg({
  declaration: {
    name: 'get_system_summary',
    description: 'ملخص عام للنظام (عدد المستخدمين، الكورسات، الطلبات، الشهادات، الإيرادات)',
    parameters: { type: 'object', properties: {} },
  },
  handler: async (_a, _u, roleId) => {
    if (roleId > 2) {
      const my = await sql(`SELECT COUNT(*) as orders FROM orders WHERE user_id=?`, _u);
      return JSON.stringify({ myOrders: my.rows[0].orders, message: 'ملخص محدود للطلاب' });
    }
    const users = await sql('SELECT COUNT(*) as total FROM users');
    const students = await sql("SELECT COUNT(*) as total FROM users WHERE role_id=3");
    const courses = await sql('SELECT COUNT(*) as total FROM courses WHERE is_active=1');
    const orders = await sql('SELECT COUNT(*) as total FROM orders');
    const paid = await sql("SELECT COALESCE(SUM(amount),0) as total FROM orders WHERE status='paid'");
    const certs = await sql('SELECT COUNT(*) as total FROM certificates');
    const groups = await sql('SELECT COUNT(*) as total FROM groups WHERE is_active=1');
    return JSON.stringify({
      users: users.rows[0].total,
      students: students.rows[0].total,
      courses: courses.rows[0].total,
      orders: orders.rows[0].total,
      revenue: paid.rows[0].total,
      certificates: certs.rows[0].total,
      groups: groups.rows[0].total,
    });
  },
});

// ─── Exports ────────────────────────────────────────────

export function getToolDeclarations() {
  return Object.values(tools).map(t => t.declaration);
}

export async function handleToolCall(name: string, args: any, userId: number, roleId: number): Promise<string> {
  const tool = tools[name];
  if (!tool) return `الأداة "${name}" غير معروفة`;
  try {
    return await tool.handler(args, userId, roleId);
  } catch (err: any) {
    console.error(`Tool ${name} error:`, err?.message || err);
    return `حدث خطأ أثناء تنفيذ "${name}": ${err?.message || 'خطأ غير متوقع'}`;
  }
}
