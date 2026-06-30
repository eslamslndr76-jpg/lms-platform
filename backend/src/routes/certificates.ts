import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT cert.id, cert.serial_id, cert.issued_at, c.title_ar, c.title_en
       FROM certificates cert JOIN courses c ON cert.course_id=c.id
       WHERE cert.user_id=? ORDER BY cert.issued_at DESC`,
      req.user!.userId,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

router.get('/verify/:serial', async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT cert.serial_id, cert.issued_at, u.name as student_name, u.email as student_email,
              c.title_ar, c.title_en
       FROM certificates cert
       JOIN users u ON cert.user_id=u.id
       JOIN courses c ON cert.course_id=c.id
       WHERE cert.serial_id=?`,
      req.params.serial,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Certificate not found' });
    res.json({ valid: true, certificate: result.rows[0] });
  } catch {
    res.status(500).json({ error: 'Verification failed' });
  }
});

export default router;
