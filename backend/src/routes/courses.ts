import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';

const router = Router();

router.get('/', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT c.*, cat.name_ar as category_name_ar, cat.name_en as category_name_en
       FROM courses c LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.is_active=1 ORDER BY c.created_at DESC`,
    );
    res.json(result.rows);
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
    res.json(result.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

router.post('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count, total_hours, instructor, materials_url } = req.body;
    if (!title_ar || !title_en) return res.status(400).json({ error: 'Arabic and English titles required' });
    const result = await sql(
      `INSERT INTO courses (title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count, total_hours, instructor, materials_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      title_ar, title_en, description || '', price || 0, category_id || null, image_url || null, max_students || 30, lecture_count || 0, total_hours || 0, instructor || '', materials_url || null,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.put('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count, total_hours, instructor, materials_url } = req.body;
    await sql(
      `UPDATE courses SET title_ar=?, title_en=?, description=?, price=?, category_id=?, image_url=?, max_students=?, lecture_count=?, total_hours=?, instructor=?, materials_url=?
       WHERE id=?`,
      title_ar, title_en, description, price, category_id, image_url, max_students, lecture_count || 0, total_hours || 0, instructor || '', materials_url, req.params.id,
    );
    res.json({ message: 'Course updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update course' });
  }
});

router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql('UPDATE courses SET is_active=0 WHERE id=?', req.params.id);
    res.json({ message: 'Course deactivated' });
  } catch {
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

export default router;
