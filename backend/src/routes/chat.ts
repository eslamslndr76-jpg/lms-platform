import { Router, Request, Response } from 'express';
import { chatCompletion } from '../utils/aiClient';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { messages, image } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    const result = await chatCompletion({
      messages: messages.map((m: any) => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
        text: m.text || m.content || '',
      })),
      userId: req.user!.userId,
      roleId: req.user!.roleId,
    });

    res.json({ reply: result.content, refreshRequired: result.refreshRequired });
  } catch (err: any) {
    console.error('Chat error:', err?.message || err);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

export default router;
