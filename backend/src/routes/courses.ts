import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';

const router = Router();

router.get('/', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const user = (_req as any).user;
    const isAdmin = user && (user.roleId === 1 || user.roleId === '1');
    let where = '';
    if (!isAdmin) where = ' WHERE c.is_active=1';
    const result = await sql(
      `SELECT c.*, cat.name_ar as category_name_ar, cat.name_en as category_name_en
       FROM courses c LEFT JOIN categories cat ON c.category_id = cat.id${where} ORDER BY c.created_at DESC`,
    );
    const rows = result.rows.map((r: any) => ({ ...r, is_active: Number(r.is_active) }));
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
    const course = { ...result.rows[0], is_active: Number(result.rows[0].is_active) };
    res.json(course);
  } catch {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

router.post('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count, lecture_duration, instructor, materials_url, course_mode } = req.body;
    if (!title_ar || !title_en) return res.status(400).json({ error: 'Arabic and English titles required' });
    const result = await sql(
      `INSERT INTO courses (title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count, lecture_duration, instructor, materials_url, course_mode)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      title_ar, title_en, description || '', price || 0, category_id || null, image_url || null, max_students || 30, lecture_count || 0, lecture_duration || 0, instructor || '', materials_url || null, course_mode || 'online',
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const allowed = ['title_ar', 'title_en', 'description', 'price', 'category_id', 'image_url', 'max_students', 'lecture_count', 'lecture_duration', 'instructor', 'materials_url', 'course_mode', 'is_active'];
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
    await sql('DELETE FROM group_students WHERE group_id IN (SELECT id FROM groups WHERE course_id=?)', id);
    await sql('DELETE FROM groups WHERE course_id=?', id);
    await sql('DELETE FROM receipts WHERE order_id IN (SELECT id FROM orders WHERE course_id=?)', id);
    await sql('DELETE FROM certificates WHERE course_id=?', id);
    await sql('UPDATE orders SET receipt_url=NULL WHERE course_id=?', id);
    await sql('DELETE FROM orders WHERE course_id=?', id);
    await sql('DELETE FROM courses WHERE id=?', id);
    res.json({ message: 'Course deleted permanently' });
  } catch {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
