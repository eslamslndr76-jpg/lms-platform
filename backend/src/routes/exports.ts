import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';

const router = Router();

router.get('/students/:courseId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const course = await sql('SELECT title_ar FROM courses WHERE id=?', courseId);
    if (course.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    const students = await sql(
      `SELECT u.name, u.email, u.phone, o.status, o.created_at as order_date
       FROM orders o JOIN users u ON o.user_id=u.id
       WHERE o.course_id=? AND o.status='paid'
       ORDER BY u.name ASC`,
      courseId,
    );
    const format = req.query.format as string || 'json';
    if (format === 'json') return res.json({ course: course.rows[0], students: students.rows });

    const data = students.rows.map((s: any) => ({
      name: s.name, email: s.email, phone: s.phone, status: s.status, date: s.order_date,
    }));
    const json = JSON.stringify({ course: (course.rows[0] as any).title_ar, data }, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="students-course-${courseId}.json"`);
    res.send(json);
  } catch {
    res.status(500).json({ error: 'Failed to export students' });
  }
});

router.get('/orders', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT o.id, u.name as student, c.title_ar as course, o.amount, o.status, o.created_at
       FROM orders o JOIN users u ON o.user_id=u.id JOIN courses c ON o.course_id=c.id
       ORDER BY o.created_at DESC`,
    );
    const json = JSON.stringify({ data: result.rows }, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="orders-export.json"');
    res.send(json);
  } catch {
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

router.get('/financials', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as count, SUM(amount) as total
       FROM orders WHERE status='paid'
       GROUP BY month ORDER BY month DESC`,
    );
    const json = JSON.stringify({ data: result.rows }, null, 2);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="financials-export.json"');
    res.send(json);
  } catch {
    res.status(500).json({ error: 'Failed to export financials' });
  }
});

export default router;
