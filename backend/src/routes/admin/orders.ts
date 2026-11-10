import { Router, Request, Response } from 'express';
import { sql, escape } from '../../db/helpers';
import { execute } from '../../db/turso-http';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, requirePermission, ADMIN, EMPLOYEE } from '../../middleware/rbac';
import * as groupService from '../../services/groupService';
import { sendNotification } from '../../services/externalNotificationService';
import { attachOrderDetails, getOrderCourseTitles } from '../../services/orderService';

const router = Router();

const MAX_ITEMS = 20;

/** Accepts `items:[{course_id}]`, `items:[1,2]`, or the legacy single `course_id`. */
function readCourseIds(body: any): number[] {
  const raw: unknown[] = Array.isArray(body?.items)
    ? body.items
    : body?.course_id !== undefined && body?.course_id !== null
      ? [body.course_id]
      : [];
  const ids: number[] = [];
  for (const entry of raw) {
    const value = typeof entry === 'object' && entry !== null ? (entry as any).course_id : entry;
    const id = Number(value);
    if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function courseTitlesForIds(ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const result = await sql(
    `SELECT id, title_ar FROM courses WHERE id IN (${ids.map(() => '?').join(',')})`,
    ...ids,
  );
  return new Map((result.rows as any[]).map((r) => [Number(r.id), String(r.title_ar || '')]));
}

// ─────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────
router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('orders', 'read'), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const courseId = req.query.courseId as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (status && status !== 'all') {
      where += ' AND o.status=?'; params.push(status);
    }
    if (search) {
      where += ` AND (u.name LIKE '%'||?||'%' OR u.email LIKE '%'||?||'%'
        OR EXISTS (SELECT 1 FROM order_items oi JOIN courses c ON oi.course_id=c.id
                   WHERE oi.order_id=o.id AND c.title_ar LIKE '%'||?||'%'))`;
      params.push(search, search, search);
    }
    if (courseId) {
      where += ' AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id=o.id AND oi.course_id=?)';
      params.push(courseId);
    }

    const countResult = await sql(
      `SELECT COUNT(*) as count FROM orders o JOIN users u ON o.user_id=u.id ${where}`,
      ...params,
    );
    const total = Number(countResult.rows[0].count);

    const result = await sql(
      `SELECT o.*, u.name as student_name, u.email as student_email, u.phone as student_phone
       FROM orders o JOIN users u ON o.user_id=u.id
       ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    );

    const orders = await attachOrderDetails(result.rows as any[]);
    res.json({ orders, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    console.error('Admin fetch orders error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل الطلبات' });
  }
});

// ─────────────────────────────────────────────────────────────
// Financials (amount is the order total, one row per order)
// ─────────────────────────────────────────────────────────────
router.get('/financials', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('financials', 'read'), async (_req: Request, res: Response) => {
  try {
    const total = await sql(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as sum FROM orders WHERE status='paid'`,
    );
    const pending = await sql(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as sum FROM orders WHERE status='pending'`,
    );
    const monthly = await sql(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count, SUM(amount) as sum
       FROM orders WHERE status='paid' AND created_at >= date('now','-6 months')
       GROUP BY month ORDER BY month DESC`,
    );
    const recentResult = await sql(
      `SELECT o.*, u.name as student_name FROM orders o
       JOIN users u ON o.user_id=u.id
       ORDER BY o.created_at DESC LIMIT 10`,
    );
    const recent = await attachOrderDetails(recentResult.rows as any[], { withReceipt: false });
    res.json({
      totalPaid: { count: Number(total.rows[0].count), sum: Number(total.rows[0].sum) },
      totalPending: { count: Number(pending.rows[0].count), sum: Number(pending.rows[0].sum) },
      monthly: monthly.rows,
      recent,
    });
  } catch (err: any) {
    console.error('Admin fetch financials error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل التقارير المالية' });
  }
});

// ─────────────────────────────────────────────────────────────
// Status transition (paid / cancelled apply to every item)
// ─────────────────────────────────────────────────────────────
router.patch('/:id/status', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('orders', 'write'), async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'رقم غير صالح' });
    const { status } = req.body;
    if (!['pending', 'review', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const orderResult = await sql('SELECT id, user_id, amount, status FROM orders WHERE id=?', orderId);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    const order = orderResult.rows[0] as any;
    const studentId = Number(order.user_id);

    // Track who cancelled an order (student / admin / expired) for the admin UI.
    await sql('UPDATE orders SET status=?, cancel_reason=? WHERE id=?', status, status === 'cancelled' ? 'admin' : null, orderId);

    const itemsResult = await sql(
      'SELECT course_id FROM order_items WHERE order_id=? ORDER BY id ASC',
      orderId,
    );
    const courseIds = (itemsResult.rows as any[]).map((r) => Number(r.course_id));
    const titles = await getOrderCourseTitles(orderId);

    if (status === 'paid') {
      await sql(
        'UPDATE orders SET verified_by=?, verified_at=CURRENT_TIMESTAMP WHERE id=?',
        req.user!.userId, orderId,
      );

      let assignedAny = false;
      for (const courseId of courseIds) {
        const courseCheck = await sql('SELECT auto_assign FROM courses WHERE id=?', courseId);
        const autoAssign = courseCheck.rows.length > 0 ? Number((courseCheck.rows[0] as any).auto_assign) : 0;
        if (autoAssign > 0) {
          const result = await groupService.autoAssignStudent(studentId, courseId);
          if (result.assigned) assignedAny = true;
        }
      }

      // One notification for the whole order (not one per course).
      await sendNotification(studentId, 'order_paid', {
        courseTitle: titles.join('، '),
        amount: Number(order.amount),
      }).catch((e) => console.error('[Notify] order_paid failed:', e.message));

      return res.json({ message: assignedAny ? 'تم تأكيد الطلب وتسكين الطالب في كورساته' : 'تم تأكيد الطلب. التسكين يحتاج إجراءً يدوياً للكورسات بلا تسكين تلقائي.' });
    }

    if (status === 'cancelled') {
      // Cancelling removes the student from the groups of every course in the order.
      for (const courseId of courseIds) {
        await sql(
          'DELETE FROM group_students WHERE user_id=? AND group_id IN (SELECT id FROM groups WHERE course_id=?)',
          studentId, courseId,
        );
      }
      await sendNotification(studentId, 'order_cancelled', {
        courseTitle: titles.join('، '),
      }).catch((e) => console.error('[Notify] order_cancelled failed:', e.message));
      return res.json({ message: `Order ${status}` });
    }

    res.json({ message: `Order ${status}` });
  } catch (err: any) {
    console.error('Admin update order status error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحديث حالة الطلب' });
  }
});

// ─────────────────────────────────────────────────────────────
// Remove one course from an order (allowed on paid orders too —
// the student is pulled from that course's groups, the total is
// recomputed and no refund amount is recorded per the owner decision)
// ─────────────────────────────────────────────────────────────
router.delete('/:id/items/:courseId', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('orders', 'write'), async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(orderId) || orderId <= 0) return res.status(400).json({ error: 'رقم طلب غير صالح' });
    if (!Number.isInteger(courseId) || courseId <= 0) return res.status(400).json({ error: 'رقم كورس غير صالح' });

    const orderResult = await sql('SELECT id, user_id, amount, status FROM orders WHERE id=?', orderId);
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'الطلب غير موجود' });
    const order = orderResult.rows[0] as any;
    const studentId = Number(order.user_id);
    if (order.status === 'cancelled') return res.status(409).json({ error: 'الطلب ملغى بالفعل' });

    const items = await sql('SELECT course_id FROM order_items WHERE order_id=?', orderId);
    const courseIds = (items.rows as any[]).map((r) => Number(r.course_id));
    if (!courseIds.includes(courseId)) return res.status(404).json({ error: 'الكورس غير موجود في هذا الطلب' });

    const titles = await courseTitlesForIds([courseId]);
    const removedTitle = titles.get(courseId) || String(courseId);

    // Removing the last course cancels the whole order (same cleanup as PATCH /:id/status).
    if (courseIds.length <= 1) {
      await sql("UPDATE orders SET status='cancelled', cancel_reason='admin', amount=0 WHERE id=?", orderId);
      await sql(
        'DELETE FROM group_students WHERE user_id=? AND group_id IN (SELECT id FROM groups WHERE course_id=?)',
        studentId, courseId,
      );
      await sendNotification(studentId, 'order_cancelled', { courseTitle: removedTitle })
        .catch((e) => console.error('[Notify] order_cancelled failed:', e.message));
      return res.json({ message: 'كان هذا آخر كورس في الطلب، أُلغي الطلب بالكامل' });
    }

    await sql('DELETE FROM order_items WHERE order_id=? AND course_id=?', orderId, courseId);
    const total = await sql('SELECT COALESCE(SUM(price),0) as total FROM order_items WHERE order_id=?', orderId);
    const newAmount = Number((total.rows[0] as any).total);
    await sql('UPDATE orders SET amount=? WHERE id=?', newAmount, orderId);

    // A paid order: the student loses access to that course's groups.
    if (order.status === 'paid') {
      await sql(
        'DELETE FROM group_students WHERE user_id=? AND group_id IN (SELECT id FROM groups WHERE course_id=?)',
        studentId, courseId,
      );
    }

    await sendNotification(studentId, 'order_course_removed', {
      courseTitle: removedTitle,
      orderId,
      newAmount,
    }).catch((e) => console.error('[Notify] order_course_removed failed:', e.message));

    res.json({ message: 'تم حذف الكورس من الطلب', amount: newAmount });
  } catch (err: any) {
    console.error('Admin remove order item error:', err?.message || err);
    res.status(500).json({ error: 'فشل حذف الكورس من الطلب' });
  }
});

// ─────────────────────────────────────────────────────────────
// Update order header fields
// ─────────────────────────────────────────────────────────────
router.put('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { amount, notes, notes_team, notes_student, payment_method, sender_phone } = req.body;
    const sets: string[] = [];
    const params: any[] = [];
    if (amount !== undefined) { sets.push('amount=?'); params.push(amount); }
    if (notes !== undefined) { sets.push('notes=?'); params.push(notes); }
    if (notes_team !== undefined) { sets.push('notes_team=?'); params.push(notes_team); }
    if (notes_student !== undefined) { sets.push('notes_student=?'); params.push(notes_student); }
    if (payment_method !== undefined) { sets.push('payment_method=?'); params.push(payment_method); }
    if (sender_phone !== undefined) { sets.push('sender_phone=?'); params.push(sender_phone); }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(Number(req.params.id));
    await sql(`UPDATE orders SET ${sets.join(', ')} WHERE id=?`, ...params);
    res.json({ message: 'Order updated' });
  } catch (err: any) {
    console.error('Admin update order error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحديث الطلب' });
  }
});

// ─────────────────────────────────────────────────────────────
// Manual creation (multi-item; old single-course body still accepted)
// ─────────────────────────────────────────────────────────────
router.post('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { user_id, payment_method, notes_team, notes_student, sender_phone } = req.body;
    const courseIds = readCourseIds(req.body);
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });
    if (courseIds.length === 0) return res.status(400).json({ error: 'يجب اختيار كورس واحد على الأقل' });
    if (courseIds.length > MAX_ITEMS) return res.status(400).json({ error: `لا يمكن إضافة أكثر من ${MAX_ITEMS} كورس في طلب واحد` });

    const titles = await courseTitlesForIds(courseIds);
    if (titles.size !== courseIds.length) return res.status(404).json({ error: 'أحد الكورسات غير موجود' });

    const pricesResult = await sql(
      `SELECT id, price FROM courses WHERE id IN (${courseIds.map(() => '?').join(',')})`,
      ...courseIds,
    );
    const priceById = new Map<number, number>((pricesResult.rows as any[]).map((r) => [Number(r.id), Number(r.price)]));
    const total = courseIds.reduce((sum, id) => sum + (priceById.get(id) || 0), 0);

    const result = await sql(
      `INSERT INTO orders (user_id, course_id, amount, status, payment_method, notes_team, notes_student, sender_phone, verified_by, verified_at)
       VALUES (?,?,?,'paid',?,?,?,?,?,CURRENT_TIMESTAMP)`,
      user_id, courseIds[0], total, payment_method || 'cash', notes_team || null, notes_student || null, sender_phone || null, req.user!.userId,
    );
    const orderId = Number(result.lastInsertRowid);

    for (const courseId of courseIds) {
      await sql(
        'INSERT INTO order_items (order_id, course_id, price) VALUES (?,?,?)',
        orderId, courseId, priceById.get(courseId) || 0,
      );
    }

    let assignedAny = false;
    for (const courseId of courseIds) {
      const courseCheck = await sql('SELECT auto_assign FROM courses WHERE id=?', courseId);
      const autoAssign = courseCheck.rows.length > 0 ? Number((courseCheck.rows[0] as any).auto_assign) : 0;
      if (autoAssign > 0) {
        const assign = await groupService.autoAssignStudent(Number(user_id), courseId);
        if (assign.assigned) assignedAny = true;
      }
    }

    await sendNotification(Number(user_id), 'order_paid', {
      courseTitle: courseIds.map((id) => titles.get(id) || '').filter(Boolean).join('، '),
      amount: total,
    }).catch((e) => console.error('[Notify] order_paid failed:', e.message));

    res.status(201).json({ id: orderId, message: assignedAny ? 'Order created and student auto-assigned' : 'Order created' });
  } catch (err: any) {
    console.error('Admin create order error:', err?.message || err);
    res.status(500).json({ error: 'فشل إنشاء الطلب' });
  }
});

// ─────────────────────────────────────────────────────────────
// Delete (removes the order, its items and its receipt)
// ─────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { return res.status(400).json({ error: 'Invalid ID' }); }

    const order = await sql('SELECT user_id FROM orders WHERE id=?', id);
    if (order.rows.length > 0) {
      const studentId = Number((order.rows[0] as any).user_id);
      const items = await sql('SELECT course_id FROM order_items WHERE order_id=?', id);
      for (const row of items.rows as any[]) {
        await sql(
          'DELETE FROM group_students WHERE user_id=? AND group_id IN (SELECT id FROM groups WHERE course_id=?)',
          studentId, Number(row.course_id),
        );
      }
    }

    await execute('DELETE FROM receipts WHERE order_id=' + escape(id));
    await sql('DELETE FROM order_items WHERE order_id=?', id);
    await sql('DELETE FROM orders WHERE id=?', id);

    res.json({ message: 'Order deleted permanently' });
  } catch (err: any) {
    console.error('Admin delete order error:', err?.message || err);
    res.status(500).json({ error: 'فشل حذف الطلب' });
  }
});

export default router;
