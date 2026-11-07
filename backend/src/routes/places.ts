import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import {
  ADMIN,
  EMPLOYEE,
  requireRole,
  requirePermission,
  requireAnyPermission,
} from '../middleware/rbac';

const router = Router();

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

// Every place endpoint is staff-only. Reading is also allowed to anyone who can
// read groups (employees need the dropdown while creating groups).
router.use(authMiddleware, requireRole(ADMIN, EMPLOYEE));

function toInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toMinutes(value: unknown): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dayIndex(date: unknown): number | null {
  if (!date) return null;
  const d = new Date(`${String(date)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay();
}

interface LectureRow {
  group_id: number;
  date: string | null;
  time_from: string | null;
  time_to: string | null;
}

function summarizeLectures(lectures: LectureRow[]) {
  const days: string[] = [];
  for (const lecture of lectures) {
    const idx = dayIndex(lecture.date);
    if (idx != null && !days.includes(DAY_NAMES_AR[idx])) days.push(DAY_NAMES_AR[idx]);
  }
  const fromTimes = lectures.map((l) => l.time_from).filter(Boolean).sort() as string[];
  const toTimes = lectures.map((l) => l.time_to).filter(Boolean).sort() as string[];
  return {
    days,
    time_from: fromTimes[0] || '',
    time_to: toTimes[toTimes.length - 1] || '',
  };
}

function lecturesOverlap(a: LectureRow, b: LectureRow): boolean {
  if (dayIndex(a.date) !== dayIndex(b.date)) return false;
  const aFrom = toMinutes(a.time_from);
  const aTo = toMinutes(a.time_to);
  const bFrom = toMinutes(b.time_from);
  const bTo = toMinutes(b.time_to);
  if (aFrom == null || aTo == null || bFrom == null || bTo == null) return false;
  return aFrom < bTo && bFrom < aTo;
}

async function loadPlace(id: number) {
  const result = await sql('SELECT * FROM places WHERE id=?', id);
  return result.rows[0] as any | undefined;
}

async function countGroupsUsingPlace(placeId: number): Promise<number> {
  const result = await sql('SELECT COUNT(*) as cnt FROM groups WHERE place_id=?', placeId);
  return Number(result.rows[0]?.cnt || 0);
}

// ─────────────────────────────────────────────────────────────
// List / read
// ─────────────────────────────────────────────────────────────

router.get(
  '/',
  requireAnyPermission(['places', 'groups', 'settings'], 'read'),
  async (req: Request, res: Response) => {
    try {
      const onlyActive = String(req.query.active || '') === '1';
      const result = await sql(
        `SELECT p.*,
                (SELECT COUNT(*) FROM groups g WHERE g.place_id=p.id) AS groups_count
         FROM places p
         ${onlyActive ? 'WHERE p.is_active=1' : ''}
         ORDER BY p.is_active DESC, p.name ASC`,
      );
      res.json(
        result.rows.map((row: any) => ({
          ...row,
          id: Number(row.id),
          capacity: Number(row.capacity),
          is_active: Number(row.is_active),
          groups_count: Number(row.groups_count),
        })),
      );
    } catch {
      res.status(500).json({ error: 'تعذر تحميل الأماكن' });
    }
  },
);

// Conflict check must be declared before /:id so "conflicts" is not parsed as an id.
router.get('/conflicts', async (req: Request, res: Response) => {
  try {
    const placeId = toInt(req.query.placeId);
    const groupId = toInt(req.query.groupId);
    if (!placeId) return res.status(400).json({ error: 'placeId مطلوب' });
    const place = await loadPlace(placeId);
    if (!place) return res.status(404).json({ error: 'المكان غير موجود' });

    const others = await sql(
      groupId
        ? 'SELECT id, name FROM groups WHERE place_id=? AND id<>? ORDER BY created_at DESC'
        : 'SELECT id, name FROM groups WHERE place_id=? ORDER BY created_at DESC',
      ...(groupId ? [placeId, groupId] : [placeId]),
    );

    const targetLectures = groupId
      ? ((await sql('SELECT group_id, date, time_from, time_to FROM lectures WHERE group_id=?', groupId))
          .rows as unknown as LectureRow[])
      : [];

    const groups: any[] = [];
    const conflicts: any[] = [];

    for (const row of others.rows as any[]) {
      const lectures = (
        await sql('SELECT group_id, date, time_from, time_to FROM lectures WHERE group_id=?', row.id)
      ).rows as unknown as LectureRow[];
      const summary = summarizeLectures(lectures);
      const group = {
        id: Number(row.id),
        name: row.name,
        ...summary,
      };
      groups.push(group);

      if (targetLectures.length > 0 && lectures.length > 0) {
        const matched = targetLectures.filter((t) =>
          lectures.some((l) => lecturesOverlap(t, l)),
        );
        if (matched.length > 0) {
          conflicts.push({
            ...group,
            matched_days: summarizeLectures(matched).days,
          });
        }
      }
    }

    res.json({ place: { id: Number(place.id), name: place.name, capacity: Number(place.capacity) }, conflicts, groups });
  } catch {
    res.status(500).json({ error: 'تعذر التحقق من تعارض المكان' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const place = await loadPlace(Number(req.params.id));
    if (!place) return res.status(404).json({ error: 'المكان غير موجود' });
    res.json({
      ...place,
      id: Number(place.id),
      capacity: Number(place.capacity),
      is_active: Number(place.is_active),
      groups_count: await countGroupsUsingPlace(Number(place.id)),
    });
  } catch {
    res.status(500).json({ error: 'تعذر تحميل المكان' });
  }
});

// ─────────────────────────────────────────────────────────────
// Create / update / disable
// ─────────────────────────────────────────────────────────────

router.post('/', requirePermission('places', 'write'), async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim();
    const capacity = toInt(req.body?.capacity);
    if (!name) return res.status(400).json({ error: 'اسم المكان مطلوب' });
    if (!capacity) return res.status(400).json({ error: 'السعة يجب أن تكون رقماً أكبر من صفر' });

    const duplicate = await sql('SELECT id FROM places WHERE LOWER(name)=LOWER(?)', name);
    if (duplicate.rows.length > 0) {
      return res.status(400).json({ error: 'يوجد مكان بنفس الاسم بالفعل' });
    }

    const result = await sql(
      'INSERT INTO places (name, capacity, is_active) VALUES (?,?,1)',
      name,
      capacity,
    );
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch {
    res.status(500).json({ error: 'تعذر إضافة المكان' });
  }
});

router.put('/:id', requirePermission('places', 'write'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await loadPlace(id);
    if (!existing) return res.status(404).json({ error: 'المكان غير موجود' });

    const sets: string[] = [];
    const params: unknown[] = [];

    if (req.body?.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'اسم المكان مطلوب' });
      const duplicate = await sql('SELECT id FROM places WHERE LOWER(name)=LOWER(?) AND id<>?', name, id);
      if (duplicate.rows.length > 0) {
        return res.status(400).json({ error: 'يوجد مكان بنفس الاسم بالفعل' });
      }
      sets.push('name=?');
      params.push(name);
    }

    if (req.body?.capacity !== undefined) {
      const capacity = toInt(req.body.capacity);
      if (!capacity) {
        return res.status(400).json({ error: 'السعة يجب أن تكون رقماً أكبر من صفر' });
      }

      // A place that is in use cannot shrink below the number of students
      // already registered in any of its groups.
      const groups = await sql(
        `SELECT g.id, g.name,
                (SELECT COUNT(*) FROM group_students gs WHERE gs.group_id=g.id) AS students
         FROM groups g WHERE g.place_id=?`,
        id,
      );
      const tooSmall = (groups.rows as any[]).filter(
        (g) => Number(g.students) > capacity,
      );
      if (tooSmall.length > 0) {
        const names = tooSmall
          .map((g) => `"${g.name}" (${Number(g.students)} طالب)`)
          .join('، ');
        return res.status(400).json({
          error: `لا يمكن تقليل السعة إلى ${capacity}: المجموعات التالية بها عدد طلاب أكبر — ${names}`,
        });
      }

      sets.push('capacity=?');
      params.push(capacity);
    }

    if (req.body?.is_active !== undefined) {
      sets.push('is_active=?');
      params.push(Number(req.body.is_active) ? 1 : 0);
    }

    if (sets.length === 0) return res.json({ message: 'لا توجد تغييرات' });
    params.push(id);
    await sql(`UPDATE places SET ${sets.join(', ')} WHERE id=?`, ...params);
    res.json({ message: 'تم تحديث المكان' });
  } catch {
    res.status(500).json({ error: 'تعذر تحديث المكان' });
  }
});

router.delete('/:id', requirePermission('places', 'write'), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const existing = await loadPlace(id);
    if (!existing) return res.status(404).json({ error: 'المكان غير موجود' });

    const used = await countGroupsUsingPlace(id);
    if (used > 0) {
      // Never delete a place that was used in groups — keep history intact.
      await sql('UPDATE places SET is_active=0 WHERE id=?', id);
      return res.json({
        message: 'تم تعطيل المكان لأنه مستخدم في مجموعات سابقة، ولن يظهر للمجموعات الجديدة',
        disabled: true,
      });
    }

    await sql('DELETE FROM places WHERE id=?', id);
    res.json({ message: 'تم حذف المكان', deleted: true });
  } catch {
    res.status(500).json({ error: 'تعذر حذف المكان' });
  }
});

export default router;
