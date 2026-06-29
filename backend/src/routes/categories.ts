import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await sql('SELECT * FROM categories ORDER BY name_ar ASC');
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { name_ar, name_en, description } = req.body;
    if (!name_ar || !name_en) return res.status(400).json({ error: 'Arabic and English names required' });
    const result = await sql(
      'INSERT INTO categories (name_ar, name_en, description) VALUES (?,?,?)',
      name_ar, name_en, description || '',
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.put('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { name_ar, name_en, description } = req.body;
    await sql('UPDATE categories SET name_ar=?, name_en=?, description=? WHERE id=?',
      name_ar, name_en, description || '', req.params.id);
    res.json({ message: 'Category updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql('DELETE FROM categories WHERE id=?', req.params.id);
    res.json({ message: 'Category deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
