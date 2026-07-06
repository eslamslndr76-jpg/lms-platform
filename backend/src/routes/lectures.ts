import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';
import * as groupService from '../services/groupService';

const router = Router();

// GET /api/lectures/:groupId
router.get('/:groupId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const lectures = await groupService.getGroupLectures(Number(req.params.groupId));
    res.json(lectures);
  } catch {
    res.status(500).json({ error: 'Failed to fetch lectures' });
  }
});

// POST /api/lectures/:groupId
router.post('/:groupId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { date, time_from, time_to, topic, location, zoom_link } = req.body;
    if (!date) return res.status(400).json({ error: 'Lecture date required' });
    const id = await groupService.addLecture(Number(req.params.groupId), { date, time_from, time_to, topic, location, zoom_link });
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to create lecture' });
  }
});

// PUT /api/lectures/:groupId/:lectureId
router.put('/:groupId/:lectureId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { date, time_from, time_to, topic, location, zoom_link, is_completed } = req.body;
    await groupService.updateLecture(Number(req.params.groupId), Number(req.params.lectureId), { date, time_from, time_to, topic, location, zoom_link, is_completed });
    res.json({ message: 'Lecture updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update lecture' });
  }
});

// PATCH /api/lectures/:groupId/:lectureId/toggle
router.patch('/:groupId/:lectureId/toggle', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const is_completed = await groupService.toggleLectureComplete(Number(req.params.groupId), Number(req.params.lectureId));
    res.json({ is_completed });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to toggle lecture' });
  }
});

// DELETE /api/lectures/:groupId/:lectureId
router.delete('/:groupId/:lectureId', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await groupService.deleteLecture(Number(req.params.groupId), Number(req.params.lectureId));
    res.json({ message: 'Lecture deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete lecture' });
  }
});

export default router;
