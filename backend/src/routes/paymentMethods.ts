import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * GET /api/payment-methods
 * Only one payment route is offered: paying at the institute treasury (cash).
 * The admin still edits its label/instructions from the settings screen; any
 * digital method is kept in the DB for history but is never offered here.
 */
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT id, key, label, kind, account_number, account_name, instructions, sort_order
       FROM payment_methods
       WHERE is_active=1 AND kind='cash'
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
