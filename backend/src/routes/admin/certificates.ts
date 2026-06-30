import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sql } from '../../db/helpers';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, ADMIN } from '../../middleware/rbac';

const router = Router();

router.get('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id,
              u.name as student_name, u.email as student_email,
              c.title_ar as course_name
       FROM certificates cert
       JOIN users u ON cert.user_id=u.id
       JOIN courses c ON cert.course_id=c.id
       ORDER BY cert.issued_at DESC`,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

router.get('/students', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT DISTINCT o.user_id as id, u.name, u.email, o.course_id, c.title_ar as course_name
       FROM orders o
       JOIN users u ON o.user_id=u.id
       JOIN courses c ON o.course_id=c.id
       WHERE o.status='paid'
       AND NOT EXISTS (
         SELECT 1 FROM certificates cert
         WHERE cert.user_id=o.user_id AND cert.course_id=o.course_id
       )
       ORDER BY u.name`,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

router.post('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { user_id, course_id } = req.body;
    if (!user_id || !course_id) return res.status(400).json({ error: 'user_id and course_id required' });

    const existing = await sql(
      'SELECT id FROM certificates WHERE user_id=? AND course_id=?',
      user_id, course_id,
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Certificate already issued for this student and course' });
    }

    const serialId = crypto.randomBytes(8).toString('hex').toUpperCase();
    const result = await sql(
      'INSERT INTO certificates (user_id, course_id, serial_id) VALUES (?,?,?)',
      user_id, course_id, serialId,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid), serial_id: serialId });
  } catch {
    res.status(500).json({ error: 'Failed to issue certificate' });
  }
});

export default router;
