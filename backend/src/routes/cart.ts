import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, STUDENT } from '../middleware/rbac';

const router = Router();

router.get('/', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT ci.id, ci.course_id, ci.created_at,
              c.title_ar, c.title_en, c.price, c.image_url, c.instructor,
              cat.name_ar as category_name_ar
       FROM cart_items ci
       JOIN courses c ON ci.course_id = c.id
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE ci.user_id = ?
       ORDER BY ci.created_at DESC`,
      req.user!.userId,
    );
    const items = result.rows.map((r: any) => r);
    const total = items.reduce((sum: number, i: any) => sum + Number(i.price), 0);
    res.json({ items, total, count: items.length });
  } catch {
    res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

router.post('/', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const { course_id } = req.body;
    if (!course_id) return res.status(400).json({ error: 'course_id required' });

    const existing = await sql(
      'SELECT id FROM cart_items WHERE user_id=? AND course_id=?',
      req.user!.userId, course_id,
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'هذا الكورس موجود بالفعل في السلة' });
    }

    const result = await sql(
      'INSERT INTO cart_items (user_id, course_id) VALUES (?,?)',
      req.user!.userId, course_id,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid), message: 'Added to cart' });
  } catch {
    res.status(500).json({ error: 'Failed to add to cart' });
  }
});

router.delete('/:id', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const item = await sql('SELECT user_id FROM cart_items WHERE id=?', req.params.id);
    if (item.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    if (Number(item.rows[0].user_id) !== req.user!.userId) return res.status(403).json({ error: 'Unauthorized' });
    await sql('DELETE FROM cart_items WHERE id=?', req.params.id);
    res.json({ message: 'Item removed from cart' });
  } catch {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

router.delete('/', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    await sql('DELETE FROM cart_items WHERE user_id=?', req.user!.userId);
    res.json({ message: 'Cart cleared' });
  } catch {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

router.get('/suggestions', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const cart = await sql(
      'SELECT course_id FROM cart_items WHERE user_id=?',
      req.user!.userId,
    );
    const cartIds = cart.rows.map((c: any) => c.course_id);
    const exclude = cartIds.length > 0 ? `AND c.id NOT IN (${cartIds.map(() => '?').join(',')})` : '';
    const result = await sql(
      `SELECT c.id, c.title_ar, c.title_en, c.price, c.image_url, c.instructor,
              cat.name_ar as category_name_ar
       FROM courses c
       LEFT JOIN categories cat ON c.category_id = cat.id
       WHERE c.is_active=1 ${exclude}
       ORDER BY c.created_at DESC LIMIT 4`,
      ...cartIds,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

export default router;
