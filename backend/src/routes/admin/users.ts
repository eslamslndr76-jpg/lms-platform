import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
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
      where += ` AND (u.name LIKE '%'||?||'%' OR u.email LIKE '%'||?||'%' OR u.phone LIKE '%'||?||'%')`;
      params.push(search, search, search);
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
      `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.is_active, u.role_id, u.created_at, r.name as role_name,
              u.national_id, u.birth_date, u.gender, u.governorate, u.is_enrolled, u.university_name, u.university_code
       FROM users u JOIN roles r ON u.role_id=r.id ${where}
       ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      ...params, limit, offset,
    );

    const users = result.rows.map((u: any) => ({ ...u, is_active: Number(u.is_active), role_id: Number(u.role_id) }));
    res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, role_id, nationalId, birthDate, gender, governorate, isEnrolled, universityName, universityCode } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });

    const existing = await sql('SELECT id FROM users WHERE email=?', email);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const result = await sql(
      `INSERT INTO users (name, email, password, phone, role_id, national_id, birth_date, gender, governorate, is_enrolled, university_name, university_code)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      name, email, hashed, phone || null, role_id || 3,
      nationalId || null, birthDate || null, gender || null, governorate || null,
      isEnrolled ? 1 : 0, universityName || null, universityCode || null,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, email, phone, role_id, is_active, password, avatar, nationalId, birthDate, gender, governorate, isEnrolled, universityName, universityCode } = req.body;
    let sets = 'name=COALESCE(?,name), email=COALESCE(?,email), phone=COALESCE(?,phone), role_id=COALESCE(?,role_id), avatar=COALESCE(?,avatar)';
    const params: unknown[] = [name || null, email || null, phone !== undefined ? phone : null, role_id || null, avatar || null];

    if (is_active !== undefined) {
      sets += ', is_active=?';
      params.push(is_active);
    }
    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      sets += ', password=?';
      params.push(hashed);
    }
    if (nationalId !== undefined) { sets += ', national_id=?'; params.push(nationalId || null); }
    if (birthDate !== undefined) { sets += ', birth_date=?'; params.push(birthDate || null); }
    if (gender !== undefined) { sets += ', gender=?'; params.push(gender || null); }
    if (governorate !== undefined) { sets += ', governorate=?'; params.push(governorate || null); }
    if (isEnrolled !== undefined) { sets += ', is_enrolled=?'; params.push(isEnrolled ? 1 : 0); }
    if (universityName !== undefined) { sets += ', university_name=?'; params.push(universityName || null); }
    if (universityCode !== undefined) { sets += ', university_code=?'; params.push(universityCode || null); }

    params.push(req.params.id);
    await sql(`UPDATE users SET ${sets} WHERE id=?`, ...params);
    res.json({ message: 'User updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user!.userId) return res.status(400).json({ error: 'Cannot deactivate yourself' });
    await sql('UPDATE users SET is_active=0 WHERE id=?', id);
    res.json({ message: 'User deactivated' });
  } catch {
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

router.delete('/:id/hard', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (id === req.user!.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
    await sql('DELETE FROM cart_items WHERE user_id=?', id);
    await sql('DELETE FROM group_students WHERE user_id=?', id);
    await sql('DELETE FROM receipts WHERE order_id IN (SELECT id FROM orders WHERE user_id=?)', id);
    await sql('DELETE FROM orders WHERE user_id=?', id);
    await sql('DELETE FROM certificates WHERE user_id=?', id);
    await sql('DELETE FROM users WHERE id=?', id);
    res.json({ message: 'User deleted permanently' });
  } catch {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.put('/:id/reactivate', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql('UPDATE users SET is_active=1 WHERE id=?', req.params.id);
    res.json({ message: 'User reactivated' });
  } catch {
    res.status(500).json({ error: 'Failed to reactivate user' });
  }
});

router.get('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const user = await sql(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.is_active, u.role_id, u.created_at, r.name as role_name, r.permissions,
              u.national_id, u.birth_date, u.gender, u.governorate, u.is_enrolled, u.university_name, u.university_code
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
    res.json({ ...user.rows[0], is_active: Number(user.rows[0].is_active), role_id: Number(user.rows[0].role_id), orders: orders.rows, groups: groups.rows });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
