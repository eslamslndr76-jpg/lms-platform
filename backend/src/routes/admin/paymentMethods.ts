import { Router, Request, Response } from 'express';
import { sql } from '../../db/helpers';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, ADMIN } from '../../middleware/rbac';

const router = Router();

const KEY_RE = /^[a-z0-9_]{2,40}$/;
const KINDS = ['digital', 'cash'];
const LIMITS = { label: 100, account_number: 100, account_name: 100, instructions: 1000 };

// Every endpoint here is admin-only.
router.use(authMiddleware, requireRole(ADMIN));

function normalize(row: any) {
  return {
    ...row,
    id: Number(row.id),
    is_active: Number(row.is_active),
    sort_order: Number(row.sort_order),
    account_number: row.account_number || '',
    account_name: row.account_name || '',
    instructions: row.instructions || '',
    orders_count: row.orders_count === undefined ? undefined : Number(row.orders_count),
  };
}

/** Trimmed text, or null when it is longer than allowed. */
function readText(value: unknown, max: number): string | null {
  const v = String(value ?? '').trim();
  return v.length > max ? null : v;
}

async function countOrdersUsingKey(key: string): Promise<number> {
  const result = await sql('SELECT COUNT(*) as cnt FROM orders WHERE payment_method=?', key);
  return Number((result.rows[0] as any)?.cnt || 0);
}

async function loadMethod(id: number) {
  const result = await sql('SELECT * FROM payment_methods WHERE id=?', id);
  return result.rows[0] as any | undefined;
}

// ─────────────────────────────────────────────────────────────
// List
// ─────────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT pm.*,
              (SELECT COUNT(*) FROM orders o WHERE o.payment_method=pm.key) AS orders_count
       FROM payment_methods pm
       ORDER BY pm.sort_order ASC, pm.id ASC`,
    );
    res.json(result.rows.map(normalize));
  } catch (err: any) {
    console.error('[Admin PaymentMethods] GET / failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر تحميل طرق الدفع' });
  }
});

// ─────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const key = String(req.body?.key ?? '').trim().toLowerCase();
    const label = readText(req.body?.label, LIMITS.label);
    const kind = String(req.body?.kind ?? 'digital').trim();
    const accountNumber = readText(req.body?.account_number, LIMITS.account_number);
    const accountName = readText(req.body?.account_name, LIMITS.account_name);
    const instructions = readText(req.body?.instructions, LIMITS.instructions);

    if (!KEY_RE.test(key)) {
      return res.status(400).json({ error: 'المفتاح يجب أن يكون حروفاً إنجليزية صغيرة وأرقاماً وشرطة سفلية (2-40 حرفاً)' });
    }
    if (!label) return res.status(400).json({ error: 'اسم طريقة الدفع مطلوب' });
    if (label === null) return res.status(400).json({ error: `اسم طريقة الدفع أطول من ${LIMITS.label} حرف` });
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'نوع الطريقة يجب أن يكون digital أو cash' });
    if (accountNumber === null) return res.status(400).json({ error: `رقم الحساب أطول من ${LIMITS.account_number} حرف` });
    if (accountName === null) return res.status(400).json({ error: `اسم الحساب أطول من ${LIMITS.account_name} حرف` });
    if (instructions === null) return res.status(400).json({ error: `التعليمات أطول من ${LIMITS.instructions} حرف` });

    const duplicate = await sql('SELECT id FROM payment_methods WHERE key=?', key);
    if (duplicate.rows.length > 0) {
      return res.status(409).json({ error: 'يوجد طريقة دفع بنفس المفتاح بالفعل' });
    }

    const sortOrder = Number.isFinite(Number(req.body?.sort_order)) ? Math.max(0, Math.trunc(Number(req.body.sort_order))) : 0;
    const isActive = req.body?.is_active === undefined ? 1 : Number(req.body.is_active) ? 1 : 0;

    const result = await sql(
      `INSERT INTO payment_methods (key, label, kind, account_number, account_name, instructions, is_active, sort_order)
       VALUES (?,?,?,?,?,?,?,?)`,
      key, label, kind, accountNumber, accountName, instructions, isActive, sortOrder,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid), message: 'تمت إضافة طريقة الدفع' });
  } catch (err: any) {
    console.error('[Admin PaymentMethods] POST / failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر إضافة طريقة الدفع' });
  }
});

// ─────────────────────────────────────────────────────────────
// Update (partial)
// ─────────────────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'رقم غير صالح' });
    const existing = await loadMethod(id);
    if (!existing) return res.status(404).json({ error: 'طريقة الدفع غير موجودة' });

    const sets: string[] = [];
    const params: unknown[] = [];

    if (req.body?.key !== undefined && String(req.body.key).trim().toLowerCase() !== existing.key) {
      const key = String(req.body.key ?? '').trim().toLowerCase();
      if (!KEY_RE.test(key)) {
        return res.status(400).json({ error: 'المفتاح يجب أن يكون حروفاً إنجليزية صغيرة وأرقاماً وشرطة سفلية (2-40 حرفاً)' });
      }
      const used = await countOrdersUsingKey(existing.key);
      if (used > 0) {
        return res.status(409).json({ error: `لا يمكن تغيير مفتاح طريقة دفع مستخدمة في ${used} طلب — عطّلها وأضف طريقة جديدة بدلاً منها` });
      }
      const duplicate = await sql('SELECT id FROM payment_methods WHERE key=? AND id<>?', key, id);
      if (duplicate.rows.length > 0) {
        return res.status(409).json({ error: 'يوجد طريقة دفع بنفس المفتاح بالفعل' });
      }
      sets.push('key=?');
      params.push(key);
    }

    if (req.body?.label !== undefined) {
      const label = readText(req.body.label, LIMITS.label);
      if (label === null) return res.status(400).json({ error: `اسم طريقة الدفع أطول من ${LIMITS.label} حرف` });
      if (!label) return res.status(400).json({ error: 'اسم طريقة الدفع مطلوب' });
      sets.push('label=?');
      params.push(label);
    }

    if (req.body?.kind !== undefined) {
      const kind = String(req.body.kind).trim();
      if (!KINDS.includes(kind)) return res.status(400).json({ error: 'نوع الطريقة يجب أن يكون digital أو cash' });
      sets.push('kind=?');
      params.push(kind);
    }

    if (req.body?.account_number !== undefined) {
      const value = readText(req.body.account_number, LIMITS.account_number);
      if (value === null) return res.status(400).json({ error: `رقم الحساب أطول من ${LIMITS.account_number} حرف` });
      sets.push('account_number=?');
      params.push(value);
    }

    if (req.body?.account_name !== undefined) {
      const value = readText(req.body.account_name, LIMITS.account_name);
      if (value === null) return res.status(400).json({ error: `اسم الحساب أطول من ${LIMITS.account_name} حرف` });
      sets.push('account_name=?');
      params.push(value);
    }

    if (req.body?.instructions !== undefined) {
      const value = readText(req.body.instructions, LIMITS.instructions);
      if (value === null) return res.status(400).json({ error: `التعليمات أطول من ${LIMITS.instructions} حرف` });
      sets.push('instructions=?');
      params.push(value);
    }

    if (req.body?.is_active !== undefined) {
      sets.push('is_active=?');
      params.push(Number(req.body.is_active) ? 1 : 0);
    }

    if (req.body?.sort_order !== undefined) {
      if (!Number.isFinite(Number(req.body.sort_order))) {
        return res.status(400).json({ error: 'الترتيب يجب أن يكون رقماً' });
      }
      sets.push('sort_order=?');
      params.push(Math.max(0, Math.trunc(Number(req.body.sort_order))));
    }

    if (sets.length === 0) return res.json({ message: 'لا توجد تغييرات' });
    params.push(id);
    await sql(`UPDATE payment_methods SET ${sets.join(', ')} WHERE id=?`, ...params);
    res.json({ message: 'تم تحديث طريقة الدفع' });
  } catch (err: any) {
    console.error('[Admin PaymentMethods] PUT /:id failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر تحديث طريقة الدفع' });
  }
});

// ─────────────────────────────────────────────────────────────
// Delete (disable when the method was already used by an order)
// ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'رقم غير صالح' });
    const existing = await loadMethod(id);
    if (!existing) return res.status(404).json({ error: 'طريقة الدفع غير موجودة' });

    const used = await countOrdersUsingKey(existing.key);
    if (used > 0) {
      await sql('UPDATE payment_methods SET is_active=0 WHERE id=?', id);
      return res.json({
        message: `تم تعطيل طريقة الدفع لأنها مستخدمة في ${used} طلب سابق، ولن تظهر للطلاب`,
        disabled: true,
      });
    }

    await sql('DELETE FROM payment_methods WHERE id=?', id);
    res.json({ message: 'تم حذف طريقة الدفع', deleted: true });
  } catch (err: any) {
    console.error('[Admin PaymentMethods] DELETE /:id failed:', err?.message || err);
    res.status(500).json({ error: 'تعذر حذف طريقة الدفع' });
  }
});

export default router;
