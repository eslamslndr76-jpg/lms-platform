import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, requirePermission, ADMIN, EMPLOYEE, STUDENT } from '../middleware/rbac';
import { notifyGroupStudents } from '../services/notificationService';
import { sendNotification, notifyGroupStudents as notifyGroupStudentsExt } from '../services/externalNotificationService';

const router = Router();

const CODE_TTL = 15;

function generateCode(lectureId: number, seed: string, timestamp: number): string {
  const period = Math.floor(timestamp / CODE_TTL);
  const hash = createHash('sha256').update(`${lectureId}:${seed}:${period}`).digest('hex');
  return hash.substring(0, 6).toUpperCase();
}

function getQRData(lectureId: number, code: string): string {
  return JSON.stringify({ v: 1, l: lectureId, c: code, t: Math.floor(Date.now() / 1000) });
}

// POST /api/attendance/:lectureId/start - Admin starts attendance session
router.post('/:lectureId/start', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('groups', 'write'), async (req: Request, res: Response) => {
  try {
    const lectureId = Number(req.params.lectureId);
    const lecture = await sql(
      'SELECT l.id, l.date, l.topic, l.group_id, g.name as group_name, g.status as group_status, g.is_complete as group_is_complete, g.completed_at as group_completed_at, c.title_ar as course_name FROM lectures l JOIN groups g ON l.group_id=g.id JOIN courses c ON g.course_id=c.id WHERE l.id=?',
      lectureId,
    );
    if (lecture.rows.length === 0) return res.status(404).json({ error: 'المحاضرة غير موجودة' });
    const lecRow = lecture.rows[0] as any;
    if (lecRow.group_status === 'completed' || Number(lecRow.group_is_complete) || lecRow.group_completed_at) {
      return res.status(400).json({ error: 'المجموعة منتهية — أعد فتحها أولاً قبل فتح الحضور' });
    }

    const seed = randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    await sql(
      `UPDATE lectures SET attendance_active=1, attendance_seed=?, attendance_started_at=datetime('now'), attendance_expires_at=? WHERE id=?`,
      seed, expiresAt.toISOString(), lectureId,
    );

    // Notify all students in the group
const topicText = lecRow.topic ? ` (${lecRow.topic})` : '';
    notifyGroupStudents(
      lecRow.group_id,
      '🎯 تم فتح باب الحضور!',
      `يجب تسجيل حضورك الآن لمحاضرة${topicText} — اضغط هنا لتأكيد الحضور`,
      'success',
      '/my-courses',
      ).catch(e => console.error('[Notify] attendance_opened in-app failed:', e.message));

    const nowSec = Math.floor(Date.now() / 1000);
    const code = generateCode(lectureId, seed, nowSec);
    const qrData = getQRData(lectureId, code);

    // External notification (email + telegram)
    await notifyGroupStudentsExt(lecRow.group_id, 'attendance_opened', {
      courseTitle: (lecRow as any).course_name || '',
      groupName: lecRow.group_name || '',
      topic: lecRow.topic || '',
      lectureId,
      code,
    }).catch(e => console.error('[Notify] attendance_opened failed:', e.message));

    res.json({
      seed,
      code,
      qrData,
      expiresAt: expiresAt.toISOString(),
      expiresIn: CODE_TTL,
    });
  } catch {
    res.status(500).json({ error: 'فشل بدء تسجيل الحضور' });
  }
});

// GET /api/attendance/:lectureId/current - Get current code + QR data
router.get('/:lectureId/current', authMiddleware, async (req: Request, res: Response) => {
  try {
    const lectureId = Number(req.params.lectureId);
    const result = await sql('SELECT attendance_active, attendance_seed, attendance_expires_at FROM lectures WHERE id=?', lectureId);
    if (result.rows.length === 0) return res.status(404).json({ error: 'المحاضرة غير موجودة' });

    const row = result.rows[0] as any;
    if (!row.attendance_active || Number(row.attendance_active) === 0) {
      return res.status(400).json({ error: 'تسجيل الحضور غير نشط', code: '', qrData: '', expiresIn: 0 });
    }

    const seed = row.attendance_seed as string;
    if (!seed) return res.status(400).json({ error: 'لم يتم بدء تسجيل الحضور بعد', code: '', qrData: '', expiresIn: 0 });

    const nowSec = Math.floor(Date.now() / 1000);
    const code = generateCode(lectureId, seed, nowSec);
    const qrData = getQRData(lectureId, code);

    res.json({ code, qrData, expiresIn: CODE_TTL });
  } catch {
    res.status(500).json({ error: 'فشل جلب كود الحضور' });
  }
});

// POST /api/attendance/stop/:lectureId - Admin stops attendance session
router.post('/stop/:lectureId', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('groups', 'write'), async (req: Request, res: Response) => {
  try {
    const lectureId = Number(req.params.lectureId);
    await sql('UPDATE lectures SET attendance_active=0 WHERE id=?', lectureId);
    res.json({ message: 'تم إيقاف تسجيل الحضور' });
  } catch {
    res.status(500).json({ error: 'فشل إيقاف تسجيل الحضور' });
  }
});

// POST /api/attendance/mark - Student marks attendance
router.post('/mark', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const { lectureId, code, method } = req.body;
    const userId = req.user!.userId;

    if (!lectureId || !code) {
      return res.status(400).json({ success: false, error: 'بيانات غير كاملة' });
    }

    const lecture = await sql(
      'SELECT l.*, g.course_id FROM lectures l JOIN groups g ON l.group_id=g.id WHERE l.id=?',
      lectureId,
    );
    if (lecture.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'المحاضرة غير موجودة' });
    }

    const row = lecture.rows[0] as any;
    const seed = row.attendance_seed as string;
    const isActive = Number(row.attendance_active);

    if (!isActive || !seed) {
      return res.status(400).json({ success: false, error: 'تسجيل الحضور غير متاح حالياً' });
    }

    // Check student is in the group
    const member = await sql(
      'SELECT 1 FROM group_students WHERE group_id=? AND user_id=?',
      row.group_id, userId,
    );
    if (member.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'غير مسجل في هذه المجموعة' });
    }

    // Verify code (check current and previous time period for grace)
    const nowSec = Math.floor(Date.now() / 1000);
    const expectedCurrent = generateCode(lectureId, seed, nowSec);
    const expectedPrev = generateCode(lectureId, seed, nowSec - CODE_TTL);
    const upperCode = String(code).toUpperCase().trim();

    if (upperCode !== expectedCurrent && upperCode !== expectedPrev) {
      return res.status(400).json({ success: false, error: 'الكود غير صحيح أو منتهي الصلاحية' });
    }

    // Check if already marked
    const existing = await sql(
      'SELECT attended FROM lecture_attendance WHERE lecture_id=? AND user_id=?',
      lectureId, userId,
    );
    if (existing.rows.length > 0 && Number((existing.rows[0] as any).attended)) {
      return res.json({ success: true, message: 'تم تسجيل الحضور مسبقاً', alreadyMarked: true });
    }

    // Mark attendance
    const ipAddress = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '').split(',')[0].trim();
    const verifMethod = method === 'manual' ? 'manual' : 'qr';

    await sql(
      `INSERT INTO lecture_attendance (lecture_id, user_id, attended, attended_at, verification_method, code_used, ip_address)
       VALUES (?,?,1,datetime('now'),?,?,?)
       ON CONFLICT(lecture_id, user_id) DO UPDATE SET attended=1, attended_at=datetime('now'), verification_method=?, code_used=?, ip_address=?`,
      lectureId, userId, verifMethod, upperCode, ipAddress,
      verifMethod, upperCode, ipAddress,
    );

    // External notification (email + telegram)
    const lecInfo = await sql(
      'SELECT l.topic, g.name as group_name, c.title_ar as course_name FROM lectures l JOIN groups g ON l.group_id=g.id JOIN courses c ON g.course_id=c.id WHERE l.id=?',
      lectureId,
    );
    if (lecInfo.rows.length > 0) {
      const lecData = lecInfo.rows[0] as any;
      
      // External notification (email + telegram)
      await sendNotification(userId, 'attendance_confirmed', {
        courseTitle: lecData.course_name || '',
        groupName: lecData.group_name || '',
        topic: lecData.topic || '',
      }).catch(e => console.error('[Notify] attendance_confirmed failed:', e.message));
    }

    res.json({ success: true, message: '✅ تم تسجيل الحضور بنجاح' });
  } catch {
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء تسجيل الحضور' });
  }
});

// GET /api/attendance/poll - Student polls for active attendance lectures
router.get('/poll', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await sql(
      `SELECT l.id as lectureId, l.topic, l.group_id as groupId, g.name as groupName
       FROM lectures l
       JOIN groups g ON l.group_id=g.id
       JOIN group_students gs ON gs.group_id=g.id AND gs.user_id=?
       WHERE l.attendance_active=1
       AND l.id NOT IN (
         SELECT lecture_id FROM lecture_attendance WHERE user_id=? AND attended=1
       )`,
      userId, userId,
    );

    res.json({
      active: result.rows.map((r: any) => ({
        lectureId: Number(r.lectureId),
        groupId: Number(r.groupId),
        groupName: r.groupName,
        topic: r.topic || '',
      })),
      hasActive: result.rows.length > 0,
    });
  } catch {
    res.status(500).json({ error: 'فشل جلب بيانات الحضور النشط' });
  }
});

// GET /api/attendance/:lectureId - Admin attendance report
router.get('/:lectureId', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('groups', 'read'), async (req: Request, res: Response) => {
  try {
    const lectureId = Number(req.params.lectureId);

    const lecResult = await sql('SELECT * FROM lectures WHERE id=?', lectureId);
    if (lecResult.rows.length === 0) return res.status(404).json({ error: 'المحاضرة غير موجودة' });
    const lecture = lecResult.rows[0];

    const students = await sql(
      `SELECT u.id as userId, u.name, u.email, u.avatar,
              COALESCE(la.attended,0) as attended, la.attended_at as attendedAt,
              la.verification_method as method
       FROM group_students gs
       JOIN users u ON gs.user_id=u.id
       LEFT JOIN lecture_attendance la ON la.user_id=u.id AND la.lecture_id=?
       WHERE gs.group_id=?
       ORDER BY u.name`,
      lectureId, (lecture as any).group_id,
    );

    const present = students.rows.filter((s: any) => Number(s.attended)).length;
    const total = students.rows.length;

    res.json({
      lecture,
      summary: { present, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0 },
      students: students.rows,
    });
  } catch {
    res.status(500).json({ error: 'فشل جلب تقرير الحضور' });
  }
});

// GET /api/attendance/my/:lectureId - Student checks own attendance
router.get('/my/:lectureId', authMiddleware, requireRole(STUDENT), async (req: Request, res: Response) => {
  try {
    const lectureId = Number(req.params.lectureId);
    const userId = req.user!.userId;

    const result = await sql(
      'SELECT attended, attended_at, verification_method FROM lecture_attendance WHERE lecture_id=? AND user_id=?',
      lectureId, userId,
    );

    if (result.rows.length === 0) {
      return res.json({ attended: false, attendedAt: null, method: null });
    }

    const row = result.rows[0] as any;
    res.json({
      attended: Boolean(Number(row.attended)),
      attendedAt: row.attended_at,
      method: row.verification_method,
    });
  } catch {
    res.status(500).json({ error: 'فشل جلب حالة الحضور' });
  }
});

export default router;
