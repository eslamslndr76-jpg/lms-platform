import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';

const router = Router();

async function calcIsComplete(groupId: number): Promise<number> {
  const g = await sql('SELECT * FROM groups WHERE id=?', groupId);
  if (g.rows.length === 0) return 0;
  const grp = g.rows[0] as any;
  const lec = await sql('SELECT COUNT(*) as cnt FROM lectures WHERE group_id=?', groupId);
  const lectureCount = Number(lec.rows[0].cnt);
  const complete = (
    grp.name &&
    grp.start_date &&
    grp.instructor_name &&
    lectureCount > 0
  ) ? 1 : 0;
  await sql('UPDATE groups SET is_complete=? WHERE id=?', complete, groupId);
  return complete;
}

// GET /api/groups/incomplete — list incomplete groups (for dashboard alerts)
router.get('/incomplete', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT g.id, g.name, g.is_complete,
              c.title_ar as course_name
       FROM groups g JOIN courses c ON g.course_id=c.id
       WHERE g.is_complete=0 AND g.is_active=1
       ORDER BY g.created_at DESC`,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch incomplete groups' });
  }
});

router.get('/my', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT g.id, g.name, g.schedule, g.zoom_link, g.start_date, g.end_date,
              g.instructor_name, g.location, g.is_complete,
              c.id as course_id, c.title_ar, c.title_en
       FROM group_students gs
       JOIN groups g ON gs.group_id=g.id
       JOIN courses c ON g.course_id=c.id
       WHERE gs.user_id=? AND g.is_active=1
       ORDER BY g.created_at DESC LIMIT 1`,
      req.user!.userId,
    );
    if (result.rows.length === 0) return res.json(null);
    const group = result.rows[0] as any;
    if (group.schedule) group.schedule = JSON.parse(group.schedule);

    // Get next lecture
    const lectures = await sql(
      `SELECT * FROM lectures WHERE group_id=? AND is_completed=0
       ORDER BY sort_order ASC, id ASC LIMIT 1`,
      group.id,
    );
    group.next_lecture = lectures.rows.length > 0 ? lectures.rows[0] : null;

    // Get lecture count
    const lecCount = await sql(
      `SELECT COUNT(*) as total, SUM(is_completed) as done
       FROM lectures WHERE group_id=?`,
      group.id,
    );
    group.lecture_progress = {
      total: Number(lecCount.rows[0].total),
      done: Number(lecCount.rows[0].done || 0),
    };

    res.json(group);
  } catch {
    res.status(500).json({ error: 'Failed to fetch my group' });
  }
});

router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const courseId = req.query.courseId as string | undefined;
    let query = `SELECT g.*, c.title_ar as course_name, c.title_en as course_title_en
                 FROM groups g JOIN courses c ON g.course_id=c.id`;
    const params: unknown[] = [];
    if (courseId) { query += ' WHERE g.course_id=?'; params.push(courseId); }
    query += ' ORDER BY g.created_at DESC';
    const result = await sql(query, ...params);

    const groupsWithDetails = await Promise.all(result.rows.map(async (g: any) => {
      const count = await sql('SELECT COUNT(*) as count FROM group_students WHERE group_id=?', g.id);
      const lec = await sql(
        'SELECT COUNT(*) as total, SUM(is_completed) as done FROM lectures WHERE group_id=?',
        g.id,
      );
      return {
        ...g,
        student_count: Number(count.rows[0].count),
        is_active: Number(g.is_active),
        is_complete: Number(g.is_complete),
        lecture_count: Number(lec.rows[0].total || 0),
        lecture_done: Number(lec.rows[0].done || 0),
        instructor_name: g.instructor_name || '',
        location: g.location || '',
        max_students: g.max_students || null,
      };
    }));
    res.json(groupsWithDetails);
  } catch {
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

router.post('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { course_id, name, schedule, zoom_link, start_date, end_date, instructor_name, location, max_students } = req.body;
    if (!course_id || !name) return res.status(400).json({ error: 'Course ID and name required' });
    const result = await sql(
      `INSERT INTO groups (course_id, name, schedule, zoom_link, start_date, end_date, instructor_name, location, max_students, is_complete)
       VALUES (?,?,?,?,?,?,?,?,?,0)`,
      course_id, name, JSON.stringify(schedule || {}), zoom_link || null, start_date || null, end_date || null,
      instructor_name || null, location || null, max_students || null,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'Failed to create group' });
  }
});

router.put('/:id', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { course_id, name, schedule, zoom_link, start_date, end_date, is_active, instructor_name, location, max_students } = req.body;
    let fields = 'name=?, schedule=?, zoom_link=?, start_date=?, end_date=?, instructor_name=?, location=?, max_students=?';
    const params: any[] = [name, JSON.stringify(schedule || {}), zoom_link, start_date, end_date, instructor_name, location, max_students];
    if (course_id) { fields += ', course_id=?'; params.push(course_id); }
    if (is_active !== undefined) { fields += ', is_active=?'; params.push(is_active); }
    params.push(req.params.id);
    await sql(`UPDATE groups SET ${fields} WHERE id=?`, ...params);
    await calcIsComplete(Number(req.params.id));
    res.json({ message: 'Group updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update group' });
  }
});

router.delete('/:id', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql('DELETE FROM lectures WHERE group_id=?', req.params.id);
    await sql('DELETE FROM group_students WHERE group_id=?', req.params.id);
    await sql('DELETE FROM groups WHERE id=?', req.params.id);
    res.json({ message: 'Group deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

router.post('/:id/students', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { user_ids } = req.body;
    if (!Array.isArray(user_ids)) return res.status(400).json({ error: 'user_ids array required' });
    let added = 0;
    for (const userId of user_ids) {
      // Check if student already in this group
      const exists = await sql(
        'SELECT 1 FROM group_students WHERE group_id=? AND user_id=?',
        req.params.id, userId,
      );
      if (exists.rows.length === 0) {
        await sql('INSERT INTO group_students (group_id, user_id) VALUES (?,?)', req.params.id, userId);
        added++;
      }
    }
    res.json({ message: `${added} students added` });
  } catch {
    res.status(500).json({ error: 'Failed to add students' });
  }
});

router.delete('/:id/students/:userId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    await sql('DELETE FROM group_students WHERE group_id=? AND user_id=?', req.params.id, req.params.userId);
    res.json({ message: 'Student removed from group' });
  } catch {
    res.status(500).json({ error: 'Failed to remove student' });
  }
});

router.get('/:id/students', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT u.id, u.name, u.email, u.phone FROM group_students gs
       JOIN users u ON gs.user_id=u.id WHERE gs.group_id=?`,
      req.params.id,
    );
    res.json(result.rows);
  } catch {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

export default router;
