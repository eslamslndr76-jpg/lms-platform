import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/payment-methods
 * Payment methods the student can choose from. Only active methods are
 * returned, and a digital method without an account number is hidden until the
 * admin fills it in (a student cannot transfer to an empty number).
 */
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT id, key, label, kind, account_number, account_name, instructions, sort_order
       FROM payment_methods
       WHERE is_active=1
         AND (kind='cash' OR TRIM(COALESCE(account_number,''))<>'')
       ORDER BY sort_order ASC, id ASC`,
    );
    res.json(
      result.rows.map((row: any) => ({
        ...row,
        id: Number(row.id),
        sort_order: Number(row.sort_order),
        account_number: row.account_number || '',
        account_name: row.account_name || '',
        instructions: row.instructions || '',
      })),
    );
  } catch (err: any) {
    console.error('[PaymentMethods] GET / failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر تحميل طرق الدفع' });
  }
});

export default router;
