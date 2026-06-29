import { Router, Request, Response } from 'express';
import { sql } from '../../db/helpers';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, ADMIN } from '../../middleware/rbac';

const router = Router();

router.get('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: unknown[] = [];
    if (search) {
      where += ` AND (u.name LIKE '%'||?||'%' OR u.email LIKE '%'||?||'%')`;
      params.push(search, search);
    }
    if (role && role !== 'all') {
      where += ' AND r.name=?'; params.push(role);
    }

    const countResult = await sql(
      `SELECT COUNT(*) as count FROM users u JOIN roles r ON u.role_id=r.id ${where}`,
      ...params,
    );
    const total = Number(countResult.rows[0].count);

    const result = await sql(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at, r.name as role_name
       FROM users u JOIN roles r ON u.role_id=r.id ${where}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    );

    res.json({ users: result.rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const user = await sql(
      `SELECT u.id, u.name, u.email, u.phone, u.is_active, u.created_at, r.name as role_name
       FROM users u JOIN roles r ON u.role_id=r.id WHERE u.id=?`,
      req.params.id,
    );
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const orders = await sql(
      `SELECT o.*, c.title_ar, c.title_en FROM orders o JOIN courses c ON o.course_id=c.id WHERE o.user_id=? ORDER BY o.created_at DESC`,
      req.params.id,
    );
    const groups = await sql(
      `SELECT g.*, c.title_ar as course_name FROM groups g
       JOIN group_students gs ON g.id=gs.group_id JOIN courses c ON g.course_id=c.id
       WHERE gs.user_id=?`,
      req.params.id,
    );
    res.json({ ...user.rows[0], orders: orders.rows, groups: groups.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
