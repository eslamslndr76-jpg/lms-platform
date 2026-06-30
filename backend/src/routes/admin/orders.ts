import { Router, Request, Response } from 'express';
import { sql } from '../../db/helpers';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../../middleware/rbac';

const router = Router();

router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
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
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
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
  } catch {
    res.status(500).json({ error: 'Failed to fetch financials' });
  }
});

router.patch('/:id/status', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['pending', 'review', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    await sql('UPDATE orders SET status=? WHERE id=?', status, req.params.id);

    if (status === 'paid') {
      const order = await sql('SELECT * FROM orders WHERE id=?', req.params.id);
      if (order.rows.length > 0) {
        const o = order.rows[0];
        await sql(
          'INSERT INTO receipts (order_id, file_url, payment_method, verified_by, verified_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)',
          req.params.id, o.receipt_url || '', 'manual', req.user!.userId,
        );
      }

      // Auto-assign student to an available group
      const orderRow = order.rows[0] as any;
      const studentId = Number(orderRow.user_id);
      const courseId = Number(orderRow.course_id);

      const course = await sql('SELECT max_students FROM courses WHERE id=?', courseId);
      if (course.rows.length > 0) {
        const maxStudents = Number(course.rows[0].max_students);

        const avail = await sql(
          `SELECT g.id FROM groups g
           WHERE g.course_id=? AND g.is_active=1
           AND (SELECT COUNT(*) FROM group_students WHERE group_id=g.id) < ?
           ORDER BY (SELECT COUNT(*) FROM group_students WHERE group_id=g.id) ASC
           LIMIT 1`,
          courseId, maxStudents,
        );

        if (avail.rows.length > 0) {
          const groupId = Number(avail.rows[0].id);
          await sql('INSERT OR IGNORE INTO group_students (group_id, user_id) VALUES (?,?)', groupId, studentId);
        } else {
          const groupCount = await sql(
            "SELECT COUNT(*) as cnt FROM groups WHERE course_id=? AND name LIKE 'مجموعة%'",
            courseId,
          );
          const nextNum = Number(groupCount.rows[0].cnt) + 1;
          const insertResult = await sql(
            `INSERT INTO groups (course_id, name) VALUES (?,?)`,
            courseId, `مجموعة ${nextNum}`,
          );
          const newGroupId = Number(insertResult.lastInsertRowid);
          await sql('INSERT OR IGNORE INTO group_students (group_id, user_id) VALUES (?,?)', newGroupId, studentId);
        }
      }
    }
    res.json({ message: `Order ${status}` });
  } catch {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
