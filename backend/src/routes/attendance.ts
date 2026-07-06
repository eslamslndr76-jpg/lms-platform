import { Router, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { createHash } from 'crypto';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE, STUDENT } from '../middleware/rbac';

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

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function getLectureTimeWindow(lectureId: number): Promise<{ lectureDate: string; timeFrom: string; timeTo: string } | null> {
  const result = await sql('SELECT date, time_from, time_to FROM lectures WHERE id=?', lectureId);
  if (result.rows.length === 0) return null;
  const row = result.rows[0] as any;
  return { lectureDate: row.date, timeFrom: row.time_from || '', timeTo: row.time_to || '' };
}

function isWithinTimeWindow(lectureDate: string, timeFrom: string, timeTo: string): { ok: boolean; message: string } {
  const today = todayDateString();

  if (lectureDate !== today) {
    return { ok: false, message: 'الحضور متاح فقط في يوم المحاضرة' };
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (timeFrom && timeTo) {
    const [fh, fm] = timeFrom.split(':').map(Number);
    const [th, tm] = timeTo.split(':').map(Number);
    const fromMinutes = fh * 60 + fm;
    const toMinutes = th * 60 + tm;

    const graceBefore = 30;
    const graceAfter = 60;
    const windowStart = fromMinutes - graceBefore;
    const windowEnd = toMinutes + graceAfter;

    if (currentMinutes < windowStart) {
      return { ok: false, message: 'لم يحن وقت تسجيل الحضور بعد' };
    }
    if (currentMinutes > windowEnd) {
      return { ok: false, message: 'انتهى وقت تسجيل الحضور' };
    }
  }

  return { ok: true, message: '' };
}

// POST /api/attendance/:lectureId/start - Admin starts attendance session
router.post('/:lectureId/start', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const lectureId = Number(req.params.lectureId);
    const lecture = await sql('SELECT id, date FROM lectures WHERE id=?', lectureId);
    if (lecture.rows.length === 0) return res.status(404).json({ error: 'المحاضرة غير موجودة' });

    const seed = randomBytes(16).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    await sql(
      `UPDATE lectures SET attendance_active=1, attendance_seed=?, attendance_started_at=datetime('now'), attendance_expires_at=? WHERE id=?`,
      seed, expiresAt.toISOString(), lectureId,
    );

    const nowSec = Math.floor(Date.now() / 1000);
    const code = generateCode(lectureId, seed, nowSec);
    const qrData = getQRData(lectureId, code);

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
router.post('/stop/:lectureId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
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

    // Time window check
    if (row.date) {
      const check = isWithinTimeWindow(row.date, row.time_from || '', row.time_to || '');
      if (!check.ok) {
        return res.status(400).json({ success: false, error: check.message });
      }
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

    res.json({ success: true, message: '✅ تم تسجيل الحضور بنجاح' });
  } catch {
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء تسجيل الحضور' });
  }
});

// GET /api/attendance/:lectureId - Admin attendance report
router.get('/:lectureId', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
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
