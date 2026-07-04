import { Router, Request, Response } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../../middleware/rbac';
import * as groupService from '../../services/groupService';

const router = Router();

// GET /api/admin/unassigned/count
router.get('/count', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const count = await groupService.getUnassignedCount();
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to count unassigned' });
  }
});

// GET /api/admin/unassigned
router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const students = await groupService.getUnassignedStudents();
    res.json(students);
  } catch {
    res.status(500).json({ error: 'Failed to fetch unassigned' });
  }
});

// GET /api/admin/unassigned/course/:courseId
router.get('/course/:courseId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const students = await groupService.getUnassignedByCourse(Number(req.params.courseId));
    res.json(students);
  } catch {
    res.status(500).json({ error: 'Failed to fetch unassigned for course' });
  }
});

// POST /api/admin/assign
router.post('/assign', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { user_id, group_id } = req.body;
    if (!user_id || !group_id) return res.status(400).json({ error: 'user_id and group_id required' });
    await groupService.assignStudentToGroup(Number(user_id), Number(group_id), req.user!.userId);
    res.json({ message: 'Student assigned to group' });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to assign student' });
  }
});

export default router;
