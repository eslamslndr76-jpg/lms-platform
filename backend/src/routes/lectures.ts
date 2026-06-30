import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';

const router = Router();

// GET /api/lectures/:groupId — list lectures for a group
router.get('/:groupId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT * FROM lectures WHERE group_id=? ORDER BY sort_order ASC, id ASC`,
      req.params.groupId,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch lectures' });
  }
});

// POST /api/lectures/:groupId — add a lecture
router.post('/:groupId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { day_of_week, time_from, time_to, topic, date } = req.body;
    const maxSort = await sql('SELECT COALESCE(MAX(sort_order),0) as m FROM lectures WHERE group_id=?', req.params.groupId);
    const nextSort = Number(maxSort.rows[0].m) + 1;
    const result = await sql(
      `INSERT INTO lectures (group_id, day_of_week, time_from, time_to, topic, date, sort_order)
       VALUES (?,?,?,?,?,?,?)`,
      req.params.groupId, day_of_week || '', time_from || '', time_to || '', topic || '', date || null, nextSort,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'Failed to create lecture' });
  }
});

// PUT /api/lectures/:groupId/:lectureId — update a lecture
router.put('/:groupId/:lectureId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { day_of_week, time_from, time_to, topic, date, is_completed } = req.body;
    const sets: string[] = [];
    const params: any[] = [];
    if (day_of_week !== undefined) { sets.push('day_of_week=?'); params.push(day_of_week); }
    if (time_from !== undefined) { sets.push('time_from=?'); params.push(time_from); }
    if (time_to !== undefined) { sets.push('time_to=?'); params.push(time_to); }
    if (topic !== undefined) { sets.push('topic=?'); params.push(topic); }
    if (date !== undefined) { sets.push('date=?'); params.push(date); }
    if (is_completed !== undefined) {
      sets.push('is_completed=?');
      params.push(is_completed ? 1 : 0);
      sets.push('completed_at=?');
      params.push(is_completed ? new Date().toISOString() : null);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    params.push(req.params.lectureId);
    await sql(`UPDATE lectures SET ${sets.join(', ')} WHERE id=?`, ...params);
    res.json({ message: 'Lecture updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update lecture' });
  }
});

// PATCH /api/lectures/:groupId/:lectureId/toggle — toggle completion
router.patch('/:groupId/:lectureId/toggle', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const lec = await sql('SELECT is_completed FROM lectures WHERE id=?', req.params.lectureId);
    if (lec.rows.length === 0) return res.status(404).json({ error: 'Lecture not found' });
    const current = Number(lec.rows[0].is_completed);
    await sql(
      'UPDATE lectures SET is_completed=?, completed_at=? WHERE id=?',
      current ? 0 : 1, current ? null : new Date().toISOString(), req.params.lectureId,
    );
    res.json({ is_completed: current ? 0 : 1 });
  } catch {
    res.status(500).json({ error: 'Failed to toggle lecture' });
  }
});

// DELETE /api/lectures/:groupId/:lectureId
router.delete('/:groupId/:lectureId', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql('DELETE FROM lectures WHERE id=?', req.params.lectureId);
    res.json({ message: 'Lecture deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete lecture' });
  }
});

export default router;
