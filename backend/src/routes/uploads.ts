import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';

const router = Router();

const MAX_SIZE = 200 * 1024;

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    const size = Buffer.byteLength(file, 'utf-8');
    if (size > MAX_SIZE) return res.status(400).json({ error: 'File too large (max 200KB)' });

    res.json({ url: file });
  } catch {
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;
