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

router.get('/auto-group', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='autoGroupThreshold'");
    if (result.rows.length > 0) return res.json(JSON.parse(result.rows[0].value as string));
    res.json({ threshold: 30 });
  } catch {
    res.status(500).json({ error: 'Failed to fetch auto-group threshold' });
  }
});

router.put('/auto-group', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { threshold } = req.body;
    if (!threshold || threshold < 1) return res.status(400).json({ error: 'Threshold must be >= 1' });
    await sql(
      "INSERT INTO system_settings (key, value) VALUES ('autoGroupThreshold', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
      JSON.stringify({ threshold }), JSON.stringify({ threshold }),
    );
    res.json({ message: 'Auto-group threshold updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update auto-group threshold' });
  }
});

export default router;
