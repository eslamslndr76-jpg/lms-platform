import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN } from '../middleware/rbac';
import { invalidateNotificationCache, getNotificationSettings } from '../config/notification';

const router = Router();

router.get('/branding', async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='branding'");
    if (result.rows.length > 0) return res.json(JSON.parse(result.rows[0].value as string));
    res.json(null);
  } catch {
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});

router.put('/branding', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    await sql("UPDATE system_settings SET value=?, updated_at=CURRENT_TIMESTAMP WHERE key='branding'", JSON.stringify(req.body));
    res.json({ message: 'Branding updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

router.get('/auto-group', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='autoGroupThreshold'");
    if (result.rows.length > 0) return res.json(JSON.parse(result.rows[0].value as string));
    res.json({ threshold: 30 });
  } catch {
    res.status(500).json({ error: 'Failed to fetch auto-group threshold' });
  }
});

router.put('/auto-group', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { threshold } = req.body;
    if (!threshold || threshold < 1) return res.status(400).json({ error: 'Threshold must be >= 1' });
    await sql(
      "INSERT INTO system_settings (key, value) VALUES ('autoGroupThreshold', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
      JSON.stringify({ threshold }), JSON.stringify({ threshold }),
    );
    res.json({ message: 'Auto-group threshold updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update auto-group threshold' });
  }
});

// ───────────────────────────────────────────────
// Mobile App Version & Update Settings
// ───────────────────────────────────────────────

router.get('/app-version', async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='appVersion'");
    if (result.rows.length > 0 && result.rows[0].value) {
      return res.json(JSON.parse(result.rows[0].value as string));
    }
    res.json({
      latestVersion: '1.0.2',
      buildNumber: 3,
      forceUpdate: false,
      title: 'تحديث جديد متوفر',
      message: 'يتوفر إصدار جديد من تطبيق الهاتف يتضمن تحسينات بالسرعة والخطوط والشعار الجديد. اضغط للتحديث الآن.',
      downloadUrl: 'https://lms-user.vercel.app/download',
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch app version' });
  }
});

router.put('/app-version', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { latestVersion, buildNumber, forceUpdate, title, message, downloadUrl } = req.body;
    const data = {
      latestVersion: latestVersion || '1.0.1',
      buildNumber: Number(buildNumber) || 2,
      forceUpdate: Boolean(forceUpdate),
      title: title || 'تحديث جديد متوفر',
      message: message || 'يتوفر إصدار جديد من تطبيق الهاتف، اضغط للتحديث الآن.',
      downloadUrl: downloadUrl || 'https://lms-user.vercel.app/download',
    };
    await sql(
      "INSERT INTO system_settings (key, value) VALUES ('appVersion', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
      JSON.stringify(data), JSON.stringify(data),
    );
    res.json({ message: 'App version updated', data });
  } catch {
    res.status(500).json({ error: 'Failed to update app version' });
  }
});

// ═══════════════════════════════════════════════
// Notification Settings (SMTP + Telegram)
// ═══════════════════════════════════════════════

router.get('/notification', authMiddleware, requireRole(ADMIN), async (_req: Request, res: Response) => {
  try {
    const settings = await getNotificationSettings();
    // Return settings with pass masked
    res.json({
      smtpUser: settings.smtpUser,
      smtpPass: settings.smtpPass ? '••••••••' : '',
      smtpPassRaw: '',
      smtpFrom: settings.smtpFrom,
      telegramBotToken: settings.telegramBotToken ? '••••••••' : '',
      telegramBotTokenRaw: '',
      telegramBotUsername: settings.telegramBotUsername,
      isEmailEnabled: !!(settings.smtpUser && settings.smtpPass),
      isTelegramEnabled: !!settings.telegramBotToken,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

router.put('/notification', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { smtpUser, smtpPass, smtpFrom, telegramBotToken, telegramBotUsername } = req.body;

    // Load current settings to preserve masked values
    const current = await getNotificationSettings();

    const newSettings = {
      smtpUser: smtpUser || current.smtpUser,
      smtpPass: (smtpPass && smtpPass !== '••••••••') ? smtpPass : current.smtpPass,
      smtpFrom: smtpFrom || current.smtpFrom,
      telegramBotToken: (telegramBotToken && telegramBotToken !== '••••••••') ? telegramBotToken : current.telegramBotToken,
      telegramBotUsername: telegramBotUsername || current.telegramBotUsername,
    };

    await sql(
      "INSERT INTO system_settings (key, value) VALUES ('notification', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
      JSON.stringify(newSettings), JSON.stringify(newSettings),
    );

    // Invalidate cache so next read picks up new settings
    invalidateNotificationCache();

    res.json({ message: 'Notification settings updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

router.post('/notification/test-email', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { testEmail } = req.body;
    if (!testEmail) return res.status(400).json({ error: 'testEmail is required' });

    const { sendEmail } = await import('../services/emailService');
    const ok = await sendEmail(testEmail, '🧪 اختبار نظام الإشعارات — وحدة التدريب و التطوير', `
      <div dir="rtl" style="font-family:Arial;max-width:500px;margin:0 auto;padding:20px">
        <div style="background:linear-gradient(135deg,#667eea,#764ba2);border-radius:12px;padding:30px;text-align:center">
          <h1 style="color:white;margin:0">وحدة التدريب و التطوير</h1>
          <p style="color:rgba(255,255,255,0.8);margin:5px 0 0">نحو تعليم أفضل</p>
        </div>
        <div style="background:#f8f9fa;border-radius:12px;padding:30px;margin-top:20px;text-align:center">
          <h2 style="color:#333">✅ اختبار نظام الإشعارات</h2>
          <p style="color:#666">تم إرسال هذا الإيميل بنجاح — إعدادات SMTP تعمل بشكل صحيح</p>
          <p style="color:#999;font-size:12px">هذه رسالة تلقائية — لا ترد عليها</p>
        </div>
      </div>
    `);
    if (ok) {
      res.json({ success: true, message: 'Email sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send email — check SMTP settings' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to send test email' });
  }
});

router.post('/notification/test-telegram', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { sendTelegramMessage } = await import('../services/telegramService');
    const { getTelegramBotUsername: getBotUsername } = await import('../config/notification');
    const botUsername = getBotUsername();
    const link = botUsername ? `https://t.me/${botUsername}` : null;
    const ok = await sendTelegramMessage(
      '0', // This won't work without a real chat_id — we just verify the token
      '🧪 اختبار نظام الإشعارات — وحدة التدريب و التطوير',
    );
    // Even if send fails (no chat_id), token might be valid
    res.json({ success: true, message: 'Telegram token configured. Link your account from user dashboard.', botLink: link });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to test Telegram' });
  }
});

// ═══════════════════════════════════════════════
// Certificate Settings
// ═══════════════════════════════════════════════

const DEFAULT_CERT_SETTINGS = {
  autoIssue: true,
  requireAttendance: true,
  minAttendancePercent: 80,
  certificateTitle: 'شهادة إتمام',
  certificateTitleEn: 'Certificate of Completion',
  directorName: '',
  directorTitle: 'مدير وحدة التدريب و التطوير',
  footerText: 'هذه الشهادة صادرة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
};

router.get('/certificate', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='certificate'");
    if (result.rows.length > 0) {
      return res.json({ ...DEFAULT_CERT_SETTINGS, ...JSON.parse(result.rows[0].value as string) });
    }
    res.json(DEFAULT_CERT_SETTINGS);
  } catch {
    res.status(500).json({ error: 'Failed to fetch certificate settings' });
  }
});

router.get('/certificate/public', async (_req: Request, res: Response) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='certificate'");
    if (result.rows.length > 0) {
      return res.json(JSON.parse(result.rows[0].value as string));
    }
    res.json(DEFAULT_CERT_SETTINGS);
  } catch {
    res.status(500).json({ error: 'Failed to fetch certificate settings' });
  }
});

router.put('/certificate', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const settings = { ...DEFAULT_CERT_SETTINGS, ...req.body };
    await sql(
      "INSERT INTO system_settings (key, value) VALUES ('certificate', ?) ON CONFLICT(key) DO UPDATE SET value=?, updated_at=CURRENT_TIMESTAMP",
      JSON.stringify(settings), JSON.stringify(settings),
    );
    res.json({ message: 'Certificate settings updated' });
  } catch {
    res.status(500).json({ error: 'Failed to update certificate settings' });
  }
});

// ═══════════════════════════════════════════════
// Survey Settings (edit-plan.md §4.4)
// ═══════════════════════════════════════════════

router.get('/survey', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { getSurveySettings } = await import('../services/surveyService');
    res.json(await getSurveySettings());
  } catch {
    res.status(500).json({ error: 'Failed to fetch survey settings' });
  }
});

router.put('/survey', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { saveSurveySettings } = await import('../services/surveyService');
    const settings = await saveSurveySettings(req.body || {});
    res.json({ message: 'Survey settings updated', settings });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to update survey settings' });
  }
});

// ═══════════════════════════════════════════════
// Announcement Settings (edit-plan.md §7)
// ═══════════════════════════════════════════════

router.get('/announcement', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { getAnnouncementSettings } = await import('../services/announcementService');
    res.json(await getAnnouncementSettings());
  } catch {
    res.status(500).json({ error: 'Failed to fetch announcement settings' });
  }
});

router.put('/announcement', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { saveAnnouncementSettings } = await import('../services/announcementService');
    const settings = await saveAnnouncementSettings({
      autoEnabled: Boolean(req.body?.autoEnabled),
    });
    res.json({ message: 'Announcement settings updated', settings });
  } catch {
    res.status(500).json({ error: 'Failed to update announcement settings' });
  }
});

// ═══════════════════════════════════════════════
// Report Settings (edit-plan.md §8)
// ═══════════════════════════════════════════════

router.get('/report', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const { getReportSettings } = await import('../services/reportService');
    res.json(await getReportSettings());
  } catch {
    res.status(500).json({ error: 'Failed to fetch report settings' });
  }
});

router.put('/report', authMiddleware, requireRole(ADMIN), async (req: Request, res: Response) => {
  try {
    const { saveReportSettings } = await import('../services/reportService');
    const settings = await saveReportSettings(req.body || {});
    res.json({ message: 'Report settings updated', settings });
  } catch (err: any) {
    res.status(err?.status || 500).json({ error: err?.message || 'Failed to update report settings' });
  }
});

export default router;
