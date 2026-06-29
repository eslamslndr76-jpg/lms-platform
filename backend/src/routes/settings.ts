import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN } from '../middleware/rbac';

const router = Router();

router.get('/branding', async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='branding'");
    if (result.rows.length > 0) return res.json(JSON.parse(result.rows[0].value as string));
    res.json(null);
  } catch {
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});

router.put('/branding', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql("UPDATE system_settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='branding'", JSON.stringify(req.body));
    res.json({ message: 'Branding updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

router.get('/ai-keys', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='aiKeys'");
    if (result.rows.length > 0) return res.json(JSON.parse(result.rows[0].value as string));
    res.json([]);
  } catch {
    res.status(500).json({ error: 'Failed to fetch AI keys' });
  }
});

router.put('/ai-keys', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql("UPDATE system_settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='aiKeys'", JSON.stringify(req.body));
    res.json({ message: 'AI keys updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update AI keys' });
  }
});

export default router;
