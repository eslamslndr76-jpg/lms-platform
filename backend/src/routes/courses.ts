import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';

const router = Router();

router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const isAdmin = user && (user.roleId === 1 || user.roleId === '1');
    const conditions: string[] = [];
    const params: any[] = [];
    if (!isAdmin) conditions.push('c.is_active=1');
    if (req.query.category) { conditions.push('c.category_id=?'); params.push(req.query.category); }
    if (req.query.search) { conditions.push('(c.title_ar LIKE ? OR c.title_en LIKE ?)'); params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
    const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';
    const result = await sql(
      `SELECT c.*, cat.name_ar as category_name_ar, cat.name_en as category_name_en
       FROM courses c LEFT JOIN categories cat ON c.category_id = cat.id${where} ORDER BY c.created_at DESC`,
      ...params,
    );
    let rows: any[] = result.rows.map((r: any) => ({ ...r, is_active: Number(r.is_active), featured: Number(r.featured || 0), enable_direct_purchase: Number(r.enable_direct_purchase ?? 1), auto_assign: Number(r.auto_assign ?? 0) }));
    if (req.query.featured === '1') rows = rows.filter((r: any) => r.featured === 1);
    res.json(rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT c.*, cat.name_ar as category_name_ar, cat.name_en as category_name_en
       FROM courses c LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.id=?`,
      req.params.id,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
    const course = { ...result.rows[0], is_active: Number(result.rows[0].is_active), auto_assign: Number(result.rows[0].auto_assign ?? 0) };
    res.json(course);
  } catch {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

router.post('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count, lecture_duration, instructor, materials_url, course_mode, featured, enable_direct_purchase, auto_assign } = req.body;
    if (!title_ar || !title_en) return res.status(400).json({ error: 'Arabic and English titles required' });
    const result = await sql(
      `INSERT INTO courses (title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count, lecture_duration, instructor, materials_url, course_mode, featured, enable_direct_purchase, auto_assign)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      title_ar, title_en, description || '', price || 0, category_id || null, image_url || null, max_students || 30, lecture_count || 0, lecture_duration || 0, instructor || '', materials_url || null, course_mode || 'online', featured ? 1 : 0, enable_direct_purchase !== undefined ? (enable_direct_purchase ? 1 : 0) : 1, auto_assign !== undefined ? (auto_assign ? 1 : 0) : 0,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const allowed = ['title_ar', 'title_en', 'description', 'price', 'category_id', 'image_url', 'max_students', 'lecture_count', 'lecture_duration', 'instructor', 'materials_url', 'course_mode', 'is_active', 'featured', 'enable_direct_purchase', 'auto_assign'];
    const sets: string[] = [];
    const params: any[] = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key}=?`);
        params.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.id);
    await sql(`UPDATE courses SET ${sets.join(', ')} WHERE id=?`, ...params);
    res.json({ message: 'Course updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await sql('DELETE FROM cart_items WHERE course_id=?', id);
    await sql('DELETE FROM group_students WHERE group_id IN (SELECT id FROM groups WHERE course_id=?)', id);
    await sql('DELETE FROM lectures WHERE group_id IN (SELECT id FROM groups WHERE course_id=?)', id);
    await sql('DELETE FROM groups WHERE course_id=?', id);
    await sql('DELETE FROM receipts WHERE order_id IN (SELECT id FROM orders WHERE course_id=?)', id);
    await sql('DELETE FROM certificates WHERE course_id=?', id);
    await sql('DELETE FROM orders WHERE course_id=?', id);
    await sql('DELETE FROM courses WHERE id=?', id);
    res.json({ message: 'Course deleted permanently' });
  } catch {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
