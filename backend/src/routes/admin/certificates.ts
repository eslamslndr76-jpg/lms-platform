import { Router, Request, Response } from 'express';
import { sql } from '../../db/helpers';
import { authMiddleware } from '../../middleware/auth';
import { requireRole, requirePermission, ADMIN, EMPLOYEE } from '../../middleware/rbac';
import { sendNotification } from '../../services/externalNotificationService';
import {
  issueCertificate,
  ensureCertColumns,
  certHasStatusColumn,
} from '../../services/certificateService';

const router = Router();

// ═══════════════════════════════════════════════
// GET / — List all certificates (with status)
// ═══════════════════════════════════════════════
router.get('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('certificates', 'read'), async (req: Request, res: Response) => {
  try {
    let result;
    try {
      result = await sql(
        `SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id,
                cert.status, cert.revoked_at, cert.revoke_reason,
                u.name as student_name, u.email as student_email,
                c.title_ar as course_name
         FROM certificates cert
         JOIN users u ON cert.user_id=u.id
         JOIN courses c ON cert.course_id=c.id
         ORDER BY cert.issued_at DESC`,
      );
    } catch {
      result = await sql(
        `SELECT cert.id, cert.serial_id, cert.issued_at, cert.user_id, cert.course_id,
                'active' as status, NULL as revoked_at, NULL as revoke_reason,
                u.name as student_name, u.email as student_email,
                c.title_ar as course_name
         FROM certificates cert
         JOIN users u ON cert.user_id=u.id
         JOIN courses c ON cert.course_id=c.id
         ORDER BY cert.issued_at DESC`,
      );
    }
    res.json(result.rows);
  } catch (err: any) {
    console.error('[Admin Certificates] GET / Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch certificates' });
  }
});

// ═══════════════════════════════════════════════
// GET /students — Students eligible for certificates
// ═══════════════════════════════════════════════
router.get('/students', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('certificates', 'read'), async (req: Request, res: Response) => {
  try {
    let result;
    try {
      result = await sql(
        `SELECT DISTINCT o.user_id as id, u.name, u.email, oi.course_id, c.title_ar as course_name
         FROM orders o
         JOIN order_items oi ON oi.order_id=o.id
         JOIN users u ON o.user_id=u.id
         JOIN courses c ON oi.course_id=c.id
         WHERE o.status='paid'
         AND NOT EXISTS (
           SELECT 1 FROM certificates cert
           WHERE cert.user_id=o.user_id AND cert.course_id=oi.course_id AND cert.status='active'
         )
         ORDER BY u.name`,
      );
    } catch {
      result = await sql(
        `SELECT DISTINCT o.user_id as id, u.name, u.email, oi.course_id, c.title_ar as course_name
         FROM orders o
         JOIN order_items oi ON oi.order_id=o.id
         JOIN users u ON o.user_id=u.id
         JOIN courses c ON oi.course_id=c.id
         WHERE o.status='paid'
         AND NOT EXISTS (
           SELECT 1 FROM certificates cert
           WHERE cert.user_id=o.user_id AND cert.course_id=oi.course_id
         )
         ORDER BY u.name`,
      );
    }

    // Enrich with attendance data
    const enriched = await Promise.all(
      result.rows.map(async (row: any) => {
        try {
          const groups = await sql('SELECT id FROM groups WHERE course_id=?', row.course_id);
          const groupIds = (groups.rows as any[]).map(g => g.id);

          let attended = 0;
          let total = 0;

          if (groupIds.length > 0) {
            const placeholders = groupIds.map(() => '?').join(',');
            const totalResult = await sql(
              `SELECT COUNT(*) as total FROM lectures WHERE group_id IN (${placeholders})`,
              ...groupIds,
            );
            total = Number(totalResult.rows[0].total);

            if (total > 0) {
              const attendedResult = await sql(
                `SELECT COUNT(*) as attended
                 FROM lecture_attendance la
                 JOIN lectures l ON la.lecture_id = l.id
                 WHERE l.group_id IN (${placeholders}) AND la.user_id = ? AND la.attended = 1`,
                ...groupIds, row.id,
              );
              attended = Number(attendedResult.rows[0].attended);
            }
          }

          const attendancePercent = total > 0 ? Math.round((attended / total) * 100) : 0;
          return { ...row, attended, total, attendancePercent };
        } catch {
          return { ...row, attended: 0, total: 0, attendancePercent: 0 };
        }
      }),
    );

    res.json(enriched);
  } catch {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// ═══════════════════════════════════════════════
// POST / — Issue a certificate manually
// ═══════════════════════════════════════════════
router.post('/', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('certificates', 'write'), async (req: Request, res: Response) => {
  try {
    const { user_id, course_id } = req.body;
    if (!user_id || !course_id) return res.status(400).json({ error: 'user_id and course_id required' });

    // Shared issuance path (duplicate rule, serial, notification all inside).
    const result = await issueCertificate(Number(user_id), Number(course_id));
    if (result.issued) {
      return res.status(201).json({ id: result.certificate!.id, serial_id: result.certificate!.serial_id });
    }
    if (result.reason === 'duplicate') {
      return res.status(409).json({ error: 'Certificate already issued for this student and course' });
    }
    return res.status(500).json({ error: 'Failed to issue certificate' });
  } catch (err: any) {
    console.error('[Admin Certificates] POST / Error:', err.message);
    res.status(500).json({ error: 'Failed to issue certificate' });
  }
});

// ═══════════════════════════════════════════════
// PUT /:id/revoke — Revoke a certificate
// ═══════════════════════════════════════════════
router.put('/:id/revoke', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('certificates', 'write'), async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;
    const { reason } = req.body;

    // Lazy migration: ensure columns exist
    await ensureCertColumns();
    const hasCol = await certHasStatusColumn();

    let result;
    if (hasCol) {
      result = await sql(
        "UPDATE certificates SET status='revoked', revoked_at=CURRENT_TIMESTAMP, revoke_reason=? WHERE id=?",
        reason || null, certId,
      );
    } else {
      // Columns still not available — cannot revoke
      return res.status(500).json({ error: 'Cannot revoke — database migration pending. Try again in a moment.' });
    }

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    const certData = await sql(
      `SELECT cert.user_id, c.title_ar FROM certificates cert
       JOIN courses c ON cert.course_id=c.id WHERE cert.id=?`,
      certId,
    );
    if (certData.rows.length > 0) {
      const cert = certData.rows[0] as any;
      await sendNotification(cert.user_id, 'certificate_revoked', {
        courseTitle: cert.title_ar,
        reason: reason || 'لم يتم تحديد سبب',
      }).catch((e: any) => console.error(`[Notify] certificate_revoked failed for user ${cert.user_id}:`, e?.message || e));
    }

    res.json({ message: 'Certificate revoked successfully' });
  } catch (err: any) {
    console.error('[Admin Certificates] PUT /:id/revoke Error:', err.message);
    res.status(500).json({ error: 'Failed to revoke certificate' });
  }
});

// ═══════════════════════════════════════════════
// PUT /:id/restore — Restore a revoked certificate
// ═══════════════════════════════════════════════
router.put('/:id/restore', authMiddleware, requireRole(ADMIN, EMPLOYEE), requirePermission('certificates', 'write'), async (req: Request, res: Response) => {
  try {
    const certId = req.params.id;

    await ensureCertColumns();
    const hasCol = await certHasStatusColumn();

    let result;
    if (hasCol) {
      result = await sql(
        "UPDATE certificates SET status='active', revoked_at=NULL WHERE id=? AND status='revoked'",
        certId,
      );
    } else {
      return res.status(500).json({ error: 'Cannot restore — database migration pending. Try again in a moment.' });
    }

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: 'Certificate not found or not revoked' });
    }

    const certData = await sql(
      `SELECT cert.user_id, cert.serial_id, c.title_ar FROM certificates cert
       JOIN courses c ON cert.course_id=c.id WHERE cert.id=?`,
      certId,
    );
    if (certData.rows.length > 0) {
      const cert = certData.rows[0] as any;
      await sendNotification(cert.user_id, 'certificate_restored', {
        courseTitle: cert.title_ar,
        serialId: cert.serial_id,
      }).catch((e: any) => console.error(`[Notify] certificate_restored failed for user ${cert.user_id}:`, e?.message || e));
    }

    res.json({ message: 'Certificate restored successfully' });
  } catch (err: any) {
    console.error('[Admin Certificates] PUT /:id/restore Error:', err.message);
    res.status(500).json({ error: 'Failed to restore certificate' });
  }
});

// ═══════════════════════════════════════════════
// DELETE /:id — Permanently delete a certificate
// ═══════════════════════════════════════════════
router.delete('/:id', authMiddleware, requireRole(ADMIN), requirePermission('certificates', 'write'), async (req: Request, res: Response) => {
  try {
    await sql('DELETE FROM certificates WHERE id=?', req.params.id);
    res.json({ message: 'Certificate deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete certificate' });
  }
});

export default router;
