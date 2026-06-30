import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const router = Router();

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { file, filename } = req.body;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    let buffer: Buffer;
    let ext = '.jpg';

    if (file.startsWith('data:')) {
      const matches = file.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid data URL format' });
      const mime = matches[1];
      const base64 = matches[2];
      buffer = Buffer.from(base64, 'base64');
      ext = mime === 'image/png' ? '.png' : mime === 'image/jpeg' ? '.jpg' : '.jpg';
    } else {
      buffer = Buffer.from(file, 'utf-8');
    }

    if (buffer.length > MAX_SIZE) return res.status(400).json({ error: 'File too large (max 5MB)' });

    const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
    const filePath = path.join(UPLOAD_DIR, uniqueName);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${uniqueName}`;
    res.json({ url: fileUrl });
  } catch {
    res.status(500).json({ error: 'Upload failed' });
  }
});

export default router;