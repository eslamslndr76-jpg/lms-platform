import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN } from '../middleware/rbac';

const router = Router();

router.get('/', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const result = await sql('SELECT * FROM roles ORDER BY id ASC');
    res.json(result.rows.map(r => ({ ...r, permissions: JSON.parse(r.permissions as string || '{}') })));
  } catch {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

router.put('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { name, permissions } = req.body;
    if (permissions) {
      await sql('UPDATE roles SET permissions=? WHERE id=?', JSON.stringify(permissions), req.params.id);
    }
    if (name) {
      await sql('UPDATE roles SET name=? WHERE id=?', name, req.params.id);
    }
    res.json({ message: 'Role updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

export default router;
