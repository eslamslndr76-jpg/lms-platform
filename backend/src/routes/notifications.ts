import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as notificationService from '../services/notificationService';

const router = Router();

// GET /api/notifications — my notifications
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const notifications = await notificationService.getMyNotifications(req.user!.userId, limit);
    res.json(notifications);
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.userId);
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to count unread' });
  }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    await notificationService.markAsRead(Number(req.params.id), req.user!.userId);
    res.json({ message: 'Marked as read' });
  } catch {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    await notificationService.markAllAsRead(req.user!.userId);
    res.json({ message: 'All marked as read' });
  } catch {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

export default router;
