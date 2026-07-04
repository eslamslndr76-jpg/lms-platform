import { Router, Request, Response } from 'express';
import { sql, escape } from '../../db/helpers';
import { execute } from '../../db/turso-http';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../../middleware/rbac';
import * as groupService from '../../services/groupService';

const router = Router();

router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
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
      where += ` AND (u.name LIKE '%'||?||'%' OR c.title_ar LIKE '%'||?||'%')`;
      params.push(search, search);
    }
    if (courseId) {
      where += ' AND o.course_id=?'; params.push(courseId);
    }

    const countResult = await sql(
      `SELECT COUNT(*) as count FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id ${where}`,
      ...params,
    );
    const total = Number(countResult.rows[0].count);

    const result = await sql(
      `SELECT o.*, u.name as student_name, u.email as student_email, u.phone as student_phone,
              c.title_ar, c.title_en, c.price as course_price
       FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id
       ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    );

    res.json({ orders: result.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    console.error('Admin fetch orders error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل الطلبات' });
  }
});

router.get('/financials', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
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
    const recent = await sql(
      `SELECT o.*, u.name as student_name, c.title_ar FROM orders o
       JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id
       ORDER BY o.created_at DESC LIMIT 10`,
    );
    res.json({
      totalPaid: { count: Number(total.rows[0].count), sum: Number(total.rows[0].sum) },
      totalPending: { count: Number(pending.rows[0].count), sum: Number(pending.rows[0].sum) },
      monthly: monthly.rows,
      recent: recent.rows,
    });
  } catch (err: any) {
    console.error('Admin fetch financials error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل التقارير المالية' });
  }
});

router.patch('/:id/status', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['pending', 'review', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await sql('UPDATE orders SET status=? WHERE id=?', status, Number(req.params.id));

    if (status === 'paid') {
      const order = await sql('SELECT * FROM orders WHERE id=?', Number(req.params.id));
      if (order.rows.length === 0) {
        return res.json({ message: `Order ${status}` });
      }
      await sql(
        'UPDATE orders SET verified_by=?, verified_at=CURRENT_TIMESTAMP WHERE id=?',
        req.user!.userId, Number(req.params.id),
      );

      const orderRow = order.rows[0] as any;
      const studentId = Number(orderRow.user_id);
      const courseId = Number(orderRow.course_id);

      const courseCheck = await sql('SELECT auto_assign FROM courses WHERE id=?', courseId);
      const autoAssign = courseCheck.rows.length > 0 ? Number(courseCheck.rows[0].auto_assign) : 0;
      if (autoAssign === 0) {
        return res.json({ message: 'Order paid. Student needs manual assignment.' });
      }

      const result = await groupService.autoAssignStudent(studentId, courseId);
      if (!result.assigned) {
        return res.json({ message: 'Order paid (already in group)' });
      }
    }
    res.json({ message: `Order ${status}` });
  } catch (err: any) {
    console.error('Admin update order status error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحديث حالة الطلب' });
  }
});

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

router.post('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { user_id, course_id, amount, payment_method, notes_team, notes_student, sender_phone } = req.body;
    if (!user_id || !course_id || !amount) {
      return res.status(400).json({ error: 'user_id, course_id, and amount are required' });
    }
    const result = await sql(
      `INSERT INTO orders (user_id, course_id, amount, status, payment_method, notes_team, notes_student, sender_phone, verified_by, verified_at)
       VALUES (?,?,?,'paid',?,?,?,?,?,CURRENT_TIMESTAMP)`,
      user_id, course_id, amount, payment_method || 'cash', notes_team || null, notes_student || null, sender_phone || null, req.user!.userId,
    );
    const orderId = Number(result.lastInsertRowid);

    const courseCheck = await sql('SELECT auto_assign FROM courses WHERE id=?', course_id);
    const autoAssign = courseCheck.rows.length > 0 ? Number(courseCheck.rows[0].auto_assign) : 0;
    if (autoAssign > 0) {
      await groupService.autoAssignStudent(Number(user_id), Number(course_id));
    }
    res.status(201).json({ id: orderId, message: autoAssign ? 'Order created and student auto-assigned' : 'Order created' });
  } catch (err: any) {
    console.error('Admin create order error:', err?.message || err);
    res.status(500).json({ error: 'فشل إنشاء الطلب' });
  }
});

router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { return res.status(400).json({ error: 'Invalid ID' }); }

    // Remove student from any group for this course
    const order = await sql('SELECT user_id, course_id FROM orders WHERE id=?', id);
    if (order.rows.length > 0) {
      const row = order.rows[0] as any;
      await sql('DELETE FROM group_students WHERE user_id=? AND group_id IN (SELECT id FROM groups WHERE course_id=?)', row.user_id, row.course_id);
    }

    // Delete child records first to satisfy FK constraints
    await execute('DELETE FROM receipts WHERE order_id=' + escape(id));
    await sql('DELETE FROM orders WHERE id=?', id);

    res.json({ message: 'Order deleted permanently' });
  } catch (err: any) {
    console.error('Admin delete order error:', err?.message || err);
    res.status(500).json({ error: 'فشل حذف الطلب' });
  }
});

export default router;
