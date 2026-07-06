import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';
import * as groupService from '../services/groupService';

const router = Router();

// GET /api/groups/incomplete — for dashboard alerts
router.get('/incomplete', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const groups = await groupService.getIncompleteGroups();
    res.json(groups);
  } catch {
    res.status(500).json({ error: 'Failed to fetch incomplete groups' });
  }
});

// GET /api/groups/my — student's latest group
router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const group = await groupService.getMyLatestGroup(req.user!.userId);
    res.json(group);
  } catch {
    res.status(500).json({ error: 'Failed to fetch my group' });
  }
});

// GET /api/groups/my/all — student's all groups
router.get('/my/all', authMiddleware, async (req: Request, res: Response) => {
  try {
    const groups = await groupService.getMyGroups(req.user!.userId);
    res.json(groups);
  } catch {
    res.status(500).json({ error: 'Failed to fetch my groups' });
  }
});

// GET /api/groups/my/:id/lectures — student's lecture list for their group
router.get('/my/:id/lectures', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lectures = await groupService.getMyGroupLectures(req.user!.userId, Number(req.params.id));
    res.json(lectures);
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to fetch lectures' });
  }
});

// GET /api/groups — list (filter by ?courseId)
router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
    const groups = await groupService.getGroups(courseId);
    res.json(groups);
  } catch {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/:id — detail
router.get('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const group = await groupService.getGroupById(Number(req.params.id));
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  } catch {
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// POST /api/groups — create
router.post('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { course_id, name, zoom_link, end_date, instructor_name, location, max_students, status } = req.body;
    if (!course_id || !name) return res.status(400).json({ error: 'Course ID and name required' });
    const id = await groupService.createGroup({ course_id, name, zoom_link, end_date, instructor_name, location, max_students, status });
    res.status(201).json({ id });
  } catch (err: any) {
    console.error('Create group error:', err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to create group' });
  }
});

// PUT /api/groups/:id — update
router.put('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { name, zoom_link, end_date, instructor_name, location, max_students, is_active, status } = req.body;
    await groupService.updateGroup(Number(req.params.id), { name, zoom_link, end_date, instructor_name, location, max_students, is_active, status });
    res.json({ message: 'Group updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// ──────────────────────────────
// Batch operations (MUST be before /:id routes)
// ──────────────────────────────

// POST /api/groups/batch/delete
router.post('/batch/delete', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const deleted = await groupService.batchDeleteGroups(ids);
    res.json({ message: `${deleted} groups deleted`, deleted });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to batch delete' });
  }
});

// POST /api/groups/batch/toggle
router.post('/batch/toggle', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { ids, is_active } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const updated = await groupService.batchToggleGroups(ids, !!is_active);
    res.json({ message: `${updated} groups updated`, updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to batch toggle' });
  }
});

// POST /api/groups/batch/status
router.post('/batch/status', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (!status) return res.status(400).json({ error: 'status required' });
    const updated = await groupService.batchUpdateGroupStatus(ids, status);
    res.json({ message: `${updated} groups updated`, updated });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to batch update status' });
  }
});

// PATCH /api/groups/batch/instructor
router.patch('/batch/instructor', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { ids, instructor_name } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    if (!instructor_name) return res.status(400).json({ error: 'instructor_name required' });
    const updated = await groupService.batchUpdateGroupInstructor(ids, instructor_name);
    res.json({ message: `${updated} groups updated`, updated });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to batch update instructor' });
  }
});

// POST /api/groups/batch/assign-students
router.post('/batch/assign-students', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { user_ids, group_id } = req.body;
    if (!Array.isArray(user_ids) || user_ids.length === 0) return res.status(400).json({ error: 'user_ids array required' });
    if (!group_id) return res.status(400).json({ error: 'group_id required' });
    const assigned = await groupService.batchAssignStudents(user_ids, group_id, req.user!.userId);
    res.json({ message: `${assigned} students assigned`, assigned });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to batch assign students' });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    await groupService.deleteGroup(Number(req.params.id));
    res.json({ message: 'Group deleted' });
  } catch (err: any) {
    console.error('Delete group error:', err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to delete group' });
  }
});

// ──────────────────────────────
// Students sub-routes
// ──────────────────────────────

// GET /api/groups/:id/students
router.get('/:id/students', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const students = await groupService.getGroupStudents(Number(req.params.id));
    res.json(students);
  } catch {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// POST /api/groups/:id/students — add students
router.post('/:id/students', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids)) return res.status(400).json({ error: 'user_ids array required' });
    const added = await groupService.addStudentsToGroup(Number(req.params.id), user_ids, req.user!.userId);
    res.json({ message: `${added} students added` });
  } catch {
    res.status(500).json({ error: 'Failed to add students' });
  }
});

// DELETE /api/groups/:id/students/:userId
router.delete('/:id/students/:userId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    await groupService.removeStudentFromGroup(Number(req.params.id), Number(req.params.userId), req.user!.userId);
    res.json({ message: 'Student removed from group' });
  } catch {
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

// PUT /api/groups/:id/students/:userId/move
router.put('/:id/students/:userId/move', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { target_group_id } = req.body;
    if (!target_group_id) return res.status(400).json({ error: 'target_group_id required' });
    await groupService.moveStudent(Number(req.params.id), Number(req.params.userId), Number(target_group_id), req.user!.userId);
    res.json({ message: 'Student moved' });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to move student' });
  }
});

// ──────────────────────────────
// Unassigned students (under /api/groups)
// ──────────────────────────────

// GET /api/groups/unassigned/count
router.get('/unassigned/count', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const count = await groupService.getUnassignedCount();
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to count unassigned' });
  }
});

// GET /api/groups/unassigned
router.get('/unassigned', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (_req: Request, res: Response) => {
  try {
    const students = await groupService.getUnassignedStudents();
    res.json(students);
  } catch {
    res.status(500).json({ error: 'Failed to fetch unassigned' });
  }
});

// GET /api/groups/unassigned/course/:courseId
router.get('/unassigned/course/:courseId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const students = await groupService.getUnassignedByCourse(Number(req.params.courseId));
    res.json(students);
  } catch {
    res.status(500).json({ error: 'Failed to fetch unassigned for course' });
  }
});

// POST /api/groups/unassigned/assign
router.post('/unassigned/assign', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { user_id, group_id } = req.body;
    if (!user_id || !group_id) return res.status(400).json({ error: 'user_id and group_id required' });
    await groupService.assignStudentToGroup(Number(user_id), Number(group_id), req.user!.userId);
    res.json({ message: 'Student assigned to group' });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to assign student' });
  }
});

// ──────────────────────────────
// Lectures sub-routes (under /api/groups)
// ──────────────────────────────

// GET /api/groups/:id/lectures
router.get('/:id/lectures', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const lectures = await groupService.getGroupLectures(Number(req.params.id));
    res.json(lectures);
  } catch {
    res.status(500).json({ error: 'Failed to fetch lectures' });
  }
});

// POST /api/groups/:id/lectures
router.post('/:id/lectures', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { date, time_from, time_to, topic, location, zoom_link } = req.body;
    if (!date) return res.status(400).json({ error: 'Lecture date required' });
    const id = await groupService.addLecture(Number(req.params.id), { date, time_from, time_to, topic, location, zoom_link });
    res.status(201).json({ id });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to create lecture' });
  }
});

// PUT /api/groups/:id/lectures/:lectureId
router.put('/:id/lectures/:lectureId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { date, time_from, time_to, topic, location, zoom_link, is_completed } = req.body;
    await groupService.updateLecture(Number(req.params.id), Number(req.params.lectureId), { date, time_from, time_to, topic, location, zoom_link, is_completed });
    res.json({ message: 'Lecture updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update lecture' });
  }
});

// PATCH /api/groups/:id/lectures/:lectureId/toggle
router.patch('/:id/lectures/:lectureId/toggle', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const is_completed = await groupService.toggleLectureComplete(Number(req.params.id), Number(req.params.lectureId));
    res.json({ is_completed });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to toggle lecture' });
  }
});

// DELETE /api/groups/:id/lectures/:lectureId
router.delete('/:id/lectures/:lectureId', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await groupService.deleteLecture(Number(req.params.id), Number(req.params.lectureId));
    res.json({ message: 'Lecture deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete lecture' });
  }
});

// ──────────────────────────────
// Attendance sub-routes (under /api/groups)
// ──────────────────────────────

// GET /api/groups/:id/lectures/:lectureId/attendance
router.get('/:id/lectures/:lectureId/attendance', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const attendance = await groupService.getGroupAttendanceForLecture(Number(req.params.id), Number(req.params.lectureId));
    res.json(attendance);
  } catch {
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// POST /api/groups/:id/lectures/:lectureId/attendance — bulk set
router.post('/:id/lectures/:lectureId/attendance', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) return res.status(400).json({ error: 'records array required' });
    await groupService.bulkSetAttendance(Number(req.params.lectureId), records);
    res.json({ message: 'Attendance saved' });
  } catch {
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

export default router;
