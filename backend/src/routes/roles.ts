import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import {
  ADMIN,
  EMPLOYEE,
  PERMISSION_ACTIONS,
  SECTIONS,
  requireRole,
  normalizePermissions,
  parsePermissions,
} from '../middleware/rbac';

const router = Router();

const SYSTEM_ROLES = new Set([ADMIN, EMPLOYEE, 3]);
const RESERVED_NAMES = new Set(['admin', 'employee', 'student']);

function normalizeName(value: unknown): string {
  return String(value ?? '').trim();
}

function roleNameError(name: string): string | null {
  if (name.length < 2 || name.length > 40) return 'اسم الدور يجب أن يكون بين حرفين و40 حرفًا';
  const lower = name.toLowerCase();
  if (RESERVED_NAMES.has(lower)) return 'هذا الاسم محجوز لدور نظامي';
  return null;
}

// ─── Catalog (sections + actions) ──────────────────────────────────
router.get('/catalog', authMiddleware, requireRole(ADMIN), (_req: Request, res: Response) => {
  res.json({ sections: SECTIONS, actions: PERMISSION_ACTIONS });
});

// ─── List roles ────────────────────────────────────────────────────
router.get('/', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT r.id, r.name, r.permissions, r.created_at,
              (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS users_count
       FROM roles r
       ORDER BY r.id ASC`,
    );
    res.json(
      result.rows.map((row: any) => ({
        id: Number(row.id),
        name: String(row.name),
        permissions: parsePermissions(row.permissions),
        users_count: Number(row.users_count || 0),
        is_system: SYSTEM_ROLES.has(Number(row.id)),
        created_at: row.created_at,
      })),
    );
  } catch {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// ─── Create a custom role ──────────────────────────────────────────
router.post('/', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const name = normalizeName(req.body?.name);
    const nameError = roleNameError(name);
    if (nameError) return res.status(400).json({ error: nameError });

    const existing = await sql('SELECT id FROM roles WHERE LOWER(name)=LOWER(?)', name);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'اسم الدور مستخدم بالفعل' });

    const permissions = normalizePermissions(req.body?.permissions);
    const result = await sql(
      'INSERT INTO roles (name, permissions) VALUES (?, ?)',
      name,
      JSON.stringify(permissions),
    );
    res.status(201).json({ id: Number(result.lastInsertRowid), name, permissions });
  } catch {
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// ─── Update a role (name for custom roles, permissions for staff roles) ──
router.put('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid role id' });
    if (id === ADMIN) return res.status(400).json({ error: 'لا يمكن تعديل دور المدير' });
    if (id === 3) return res.status(400).json({ error: 'دور الطالب نظامي ولا يمكن تعديله' });

    const role = await sql('SELECT id, name FROM roles WHERE id=?', id);
    if (role.rows.length === 0) return res.status(404).json({ error: 'Role not found' });

    if (req.body?.name !== undefined) {
      if (SYSTEM_ROLES.has(id)) return res.status(400).json({ error: 'لا يمكن إعادة تسمية دور نظامي' });
      const name = normalizeName(req.body.name);
      const nameError = roleNameError(name);
      if (nameError) return res.status(400).json({ error: nameError });
      const duplicate = await sql('SELECT id FROM roles WHERE LOWER(name)=LOWER(?) AND id<>?', name, id);
      if (duplicate.rows.length > 0) return res.status(409).json({ error: 'اسم الدور مستخدم بالفعل' });
      await sql('UPDATE roles SET name=? WHERE id=?', name, id);
    }

    if (req.body?.permissions !== undefined) {
      const permissions = normalizePermissions(req.body.permissions);
      await sql('UPDATE roles SET permissions=? WHERE id=?', JSON.stringify(permissions), id);
    }

    const updated = await sql('SELECT id, name, permissions FROM roles WHERE id=?', id);
    const row: any = updated.rows[0];
    res.json({
      id: Number(row.id),
      name: String(row.name),
      permissions: parsePermissions(row.permissions),
    });
  } catch {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// ─── Delete a custom role (system roles and roles in use are protected) ──
router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid role id' });
    if (SYSTEM_ROLES.has(id)) return res.status(400).json({ error: 'لا يمكن حذف دور نظامي' });

    const role = await sql('SELECT id FROM roles WHERE id=?', id);
    if (role.rows.length === 0) return res.status(404).json({ error: 'Role not found' });

    const used = await sql('SELECT COUNT(*) AS count FROM users WHERE role_id=?', id);
    if (Number(used.rows[0]?.count || 0) > 0) {
      return res.status(409).json({ error: 'لا يمكن حذف دور مرتبط بحسابات. انقل الحسابات لدور آخر أولًا.' });
    }

    await sql('DELETE FROM roles WHERE id=?', id);
    res.json({ message: 'Role deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

export default router;
