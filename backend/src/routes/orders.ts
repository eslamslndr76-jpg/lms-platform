import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, STUDENT } from '../middleware/rbac';

const router = Router();

router.post('/', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const { course_id, amount, receipt_url, payment_method } = req.body;
    if (!course_id || !amount) return res.status(400).json({ error: 'Course ID and amount required' });

    if (receipt_url) {
      const result = await sql(
        'INSERT INTO orders (user_id, course_id, amount, status, receipt_url, payment_method) VALUES (?,?,?,\'pending\',?,?)',
        req.user!.userId, course_id, amount, receipt_url, payment_method || 'cash',
      );
      return res.status(201).json({ id: Number(result.lastInsertRowid), status: 'pending' });
    }
    const result = await sql(
      'INSERT INTO orders (user_id, course_id, amount, status, payment_method) VALUES (?,?,?,\'pending\',?)',
      req.user!.userId, course_id, amount, payment_method || 'cash',
    );
    res.status(201).json({ id: Number(result.lastInsertRowid), status: 'pending' });
  } catch {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.patch('/:id/receipt', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { receipt_url } = req.body;
    if (!receipt_url) return res.status(400).json({ error: 'receipt_url required' });
    const order = await sql('SELECT user_id FROM orders WHERE id=?', req.params.id);
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    if (Number(order.rows[0].user_id) !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    await sql('UPDATE orders SET receipt_url=?, status=\'review\' WHERE id=?', receipt_url, req.params.id);
    res.json({ message: 'Receipt uploaded' });
  } catch {
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT o.*, c.title_ar, c.title_en
       FROM orders o JOIN courses c ON o.course_id = c.id
       WHERE o.user_id=? ORDER BY o.created_at DESC`,
      req.user!.userId,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export default router;
