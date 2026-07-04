import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, STUDENT } from '../middleware/rbac';
import * as groupService from '../services/groupService';

const router = Router();

router.post('/', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const { course_id, amount, receipt_url, payment_method, note_student, sender_phone } = req.body;
    if (!course_id || !amount) return res.status(400).json({ error: 'Course ID and amount required' });

    if (receipt_url) {
      const result = await sql(
        'INSERT INTO orders (user_id, course_id, amount, status, receipt_url, payment_method, notes_student, sender_phone) VALUES (?,?,?,\'pending\',?,?,?,?)',
        req.user!.userId, course_id, amount, receipt_url, payment_method || 'cash', note_student || null, sender_phone || null,
      );
      return res.status(201).json({ id: Number(result.lastInsertRowid), status: 'pending' });
    }
    const result = await sql(
      'INSERT INTO orders (user_id, course_id, amount, status, payment_method, notes_student, sender_phone) VALUES (?,?,?,\'pending\',?,?,?)',
      req.user!.userId, course_id, amount, payment_method || 'cash', note_student || null, sender_phone || null,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid), status: 'pending' });
  } catch (err: any) {
    console.error('Order creation error:', err?.message || err);
    res.status(500).json({ error: 'فشل إنشاء الطلب، حاول مرة أخرى' });
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
  } catch (err: any) {
    console.error('Receipt upload error:', err?.message || err);
    res.status(500).json({ error: 'فشل رفع الإيصال' });
  }
});

router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT o.*, c.title_ar, c.title_en, c.instructor, c.course_mode
       FROM orders o JOIN courses c ON o.course_id = c.id
       WHERE o.user_id=? ORDER BY o.created_at DESC`,
      req.user!.userId,
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Fetch orders error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل الطلبات' });
  }
});

router.get('/my/check/:courseId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const courseId = req.params.courseId;

    const orders = await sql(
      `SELECT id FROM orders WHERE user_id=? AND course_id=? AND status='paid' LIMIT 1`,
      userId, courseId,
    );
    const hasPaidOrder = orders.rows.length > 0;

    const certs = await sql(
      `SELECT id FROM certificates WHERE user_id=? AND course_id=? LIMIT 1`,
      userId, courseId,
    );
    const hasCertificate = certs.rows.length > 0;

    res.json({ hasPaidOrder, hasCertificate });
  } catch (err: any) {
    console.error('Check order error:', err?.message || err);
    res.status(500).json({ error: 'فشل التحقق من حالة الشراء' });
  }
});

router.get('/my/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const order = await sql(
      `SELECT o.*, c.title_ar, c.title_en, c.instructor, c.course_mode, c.image_url
       FROM orders o JOIN courses c ON o.course_id = c.id
       WHERE o.id=? AND o.user_id=?`,
      req.params.id, req.user!.userId,
    );
    if (order.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const ord = order.rows[0] as any;

    const groups = await sql(
      `SELECT g.id, g.name, g.instructor_name, g.location, g.start_date, g.end_date,
              g.is_complete, g.zoom_link
       FROM group_students gs
       JOIN groups g ON gs.group_id = g.id
       WHERE gs.user_id=? AND g.course_id=? AND g.is_active=1`,
      req.user!.userId, ord.course_id,
    );
    ord.groups = groups.rows;

    res.json(ord);
  } catch (err: any) {
    console.error('Fetch order details error:', err?.message || err);
    res.status(500).json({ error: 'فشل تحميل تفاصيل الطلب' });
  }
});

export default router;
