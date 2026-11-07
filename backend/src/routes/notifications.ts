import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requireRole, ADMIN, EMPLOYEE } from '../middleware/rbac';
import * as inAppNotificationService from '../services/notificationService';
import * as extNotificationService from '../services/externalNotificationService';
import { isEmailEnabled, isTelegramEnabled, getTelegramBotUsername, getTelegramBotToken, getBackendUrl, getTelegramWebhookSecret } from '../config/notification';
import { sql } from '../db/helpers';
import { sendTelegramMessage } from '../services/telegramService';

const router = Router();

// ═══════════════════════════════════════════════
// In-App Notifications (existing)
// ═══════════════════════════════════════════════

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const notifications = await inAppNotificationService.getMyNotifications(req.user!.userId, limit);
    res.json(notifications);
  } catch {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.get('/unread-count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const count = await inAppNotificationService.getUnreadCount(req.user!.userId);
    res.json({ count });
  } catch {
    res.status(500).json({ error: 'Failed to count unread' });
  }
});

router.patch('/:id/read', authMiddleware, async (req: Request, res: Response) => {
  try {
    await inAppNotificationService.markAsRead(Number(req.params.id), req.user!.userId);
    res.json({ message: 'Marked as read' });
  } catch {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

router.patch('/read-all', authMiddleware, async (req: Request, res: Response) => {
  try {
    await inAppNotificationService.markAllAsRead(req.user!.userId);
    res.json({ message: 'All marked as read' });
  } catch {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ═══════════════════════════════════════════════
// OTP — Send Verification (Registration)
// ═══════════════════════════════════════════════

router.post('/send-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const result = await extNotificationService.sendOTP(email, 'registration');
    if (result.success) {
      res.json({ success: true, message: 'OTP sent successfully' });
    } else {
      res.status(503).json({ error: result.error || 'Failed to send OTP' });
    }
  } catch (err: any) {
    console.error('Send verification error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// OTP — Forgot Password
// ═══════════════════════════════════════════════

router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Check user exists
    const user = await sql('SELECT id FROM users WHERE email=?', email);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'البريد الإلكتروني غير مسجل' });
    }

    const result = await extNotificationService.sendOTP(email, 'password_reset');
    if (result.success) {
      res.json({ success: true, message: 'OTP sent successfully' });
    } else {
      res.status(503).json({ error: result.error || 'Failed to send OTP' });
    }
  } catch (err: any) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// OTP — Verify
// ═══════════════════════════════════════════════

router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });

    const result = await extNotificationService.verifyOTP(email, otp);

    if (result.success) {
      res.json({ success: true, message: 'OTP verified' });
    } else {
      res.status(400).json({ error: result.error || 'Invalid OTP' });
    }
  } catch (err: any) {
    console.error('Verify OTP error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// Reset Password
// ═══════════════════════════════════════════════

router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'email, otp, and newPassword are required' });
    }

    // Verify OTP
    const verifyResult = await extNotificationService.verifyOTP(email, otp);
    if (!verifyResult.success) {
      return res.status(400).json({ error: verifyResult.error || 'Invalid OTP' });
    }

    // Reset password
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(newPassword, 10);
    await sql('UPDATE users SET password=? WHERE email=?', hash, email);

    // Notify user
    const user = await sql('SELECT id FROM users WHERE email=?', email);
    if (user.rows.length > 0) {
      await extNotificationService.sendNotification(Number((user.rows[0] as any).id), 'password_reset_done', {})
        .catch(e => console.error('[Notify] password_reset_done failed:', e.message));
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err: any) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// Telegram — Link Account
// ═══════════════════════════════════════════════

router.get('/telegram/link', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const botUsername = getTelegramBotUsername();
    if (!botUsername) {
      return res.status(503).json({ error: 'Telegram bot not configured' });
    }
    const link = `https://t.me/${botUsername}?start=${userId}`;
    res.json({ link, botUsername });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/telegram/unlink', authMiddleware, async (req: Request, res: Response) => {
  try {
    await sql('UPDATE users SET telegram_chat_id=NULL WHERE id=?', req.user!.userId);
    res.json({ success: true, message: 'Telegram unlinked' });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// Telegram Webhook — Receives /start from users
// ═══════════════════════════════════════════════

router.post('/telegram/webhook', async (req: Request, res: Response) => {
  try {
    // Authenticate the caller: Telegram echoes back the secret_token that was
    // registered via setWebhook. Without this check anyone could POST a forged
    // /start payload and hijack another user's Telegram notifications.
    const expectedSecret = getTelegramWebhookSecret();
    if (expectedSecret) {
      const provided = req.headers['x-telegram-bot-api-secret-token'];
      if (provided !== expectedSecret) {
        console.warn('[Telegram Webhook] Rejected request with invalid secret token');
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
      }
    }

    const update = req.body;
    const message = update.message;
    if (!message || !message.text) {
      return res.json({ ok: true });
    }

    const text = message.text.trim();
    const chatId = String(message.chat.id);
    const chatFirstName = message.from?.first_name || '';

    // Handle /start command with payload (user linking)
    if (text.startsWith('/start')) {
      const payload = text.replace('/start', '').trim();

      if (payload && /^\d+$/.test(payload)) {
        // This is a user linking flow: /start=<userId>
        const userId = parseInt(payload, 10);

        const target = await sql('SELECT id FROM users WHERE id=?', userId);
        if (target.rows.length === 0) {
          await sendTelegramMessage(chatId, '⚠️ لم يتم العثور على حساب مرتبط بهذا الرابط. يرجى فتح رابط الربط من حسابك في المنصة.');
          return res.json({ ok: true });
        }

        // Save telegram_chat_id for this user
        await sql('UPDATE users SET telegram_chat_id=? WHERE id=?', chatId, userId);

        // Send confirmation
        await sendTelegramMessage(chatId, [
          `✅ <b>تم الربط بنجاح!</b>`,
          ``,
          `مرحباً ${chatFirstName}، تم ربط حسابك بمنصة وحدة التدريب و التطوير.`,
          `ستتلقى الآن جميع الإشعارات والتغذية الراجعة هنا.`,
          ``,
          `نحو تعليم أفضل 🎓`,
        ].join('\n'));

        console.log(`[Telegram] User ${userId} linked to chat_id ${chatId}`);
      } else if (!payload) {
        // /start without payload — generic greeting
        await sendTelegramMessage(chatId, [
          `مرحباً ${chatFirstName}! 👋`,
          ``,
          `أنا بوت إشعارات وحدة التدريب و التطوير.`,
          `لربط حسابك، يرجى فتح رابط الربط من خلال موقع المنصة.`,
          ``,
          `نحو تعليم أفضل 🎓`,
        ].join('\n'));
      }
    }

    // Always respond 200 OK to Telegram
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Telegram Webhook] Error:', err.message);
    // Still respond 200 to prevent Telegram from retrying
    res.json({ ok: true });
  }
});

// ═══════════════════════════════════════════════
// Telegram — Setup Webhook (admin only)
// ═══════════════════════════════════════════════

router.post('/telegram/setup-webhook', authMiddleware, async (req: Request, res: Response) => {
  try {
    const token = getTelegramBotToken();
    if (!token) {
      return res.status(503).json({ error: 'Telegram bot token not configured' });
    }

    // The webhook must point at the API host (this server), never at the
    // frontend host — the Next.js apps do not expose this route.
    const baseUrl = getBackendUrl() || `${req.protocol}://${req.get('host') || 'localhost:3001'}`;
    const webhookUrl = `${baseUrl.replace(/\/+$/, '')}/api/notifications/telegram/webhook`;
    const secretToken = getTelegramWebhookSecret();

    const result = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
        ...(secretToken ? { secret_token: secretToken } : {}),
      }),
    });

    const data: any = await result.json();
    if (data.ok) {
      console.log(`[Telegram] Webhook set to: ${webhookUrl}`);
      res.json({ success: true, webhookUrl, secretEnabled: !!secretToken, result: data.result });
    } else {
      console.error('[Telegram] Failed to set webhook:', data.description);
      res.status(500).json({ error: data.description || 'Failed to set webhook' });
    }
  } catch (err: any) {
    console.error('[Telegram Setup Webhook] Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/telegram/webhook-info', authMiddleware, async (req: Request, res: Response) => {
  try {
    const token = getTelegramBotToken();
    if (!token) {
      return res.status(503).json({ error: 'Telegram bot token not configured' });
    }

    const result = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const data: any = await result.json();
    if (data.ok) {
      res.json(data.result);
    } else {
      res.status(500).json({ error: data.description || 'Failed to get webhook info' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// Status
// ═══════════════════════════════════════════════

router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await sql(
      'SELECT email, telegram_chat_id, COALESCE(NULLIF(email_notifications, 0), 1) as email_notifications, COALESCE(NULLIF(telegram_notifications, 0), 1) as telegram_notifications FROM users WHERE id=?',
      req.user!.userId,
    );
    const row = user.rows[0] as any;
    res.json({
      email: {
        enabled: isEmailEnabled(),
        configured: !!row?.email,
        address: row?.email || null,
        notifications: Number(row?.email_notifications) === 1,
      },
      telegram: {
        enabled: isTelegramEnabled(),
        connected: !!row?.telegram_chat_id,
        chatId: row?.telegram_chat_id || null,
        notifications: Number(row?.telegram_notifications) === 1,
        botUsername: getTelegramBotUsername(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// Notification Preferences
// ═══════════════════════════════════════════════

router.patch('/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { email_notifications, telegram_notifications } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (email_notifications !== undefined) {
      updates.push('email_notifications=?');
      params.push(email_notifications ? 1 : 0);
    }
    if (telegram_notifications !== undefined) {
      updates.push('telegram_notifications=?');
      params.push(telegram_notifications ? 1 : 0);
    }

    if (updates.length > 0) {
      params.push(req.user!.userId);
      await sql(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, ...params);
    }

    res.json({ success: true, message: 'Preferences updated' });
  } catch (err: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ═══════════════════════════════════════════════
// Broadcast Announcement (Admin / Employee)
// ═══════════════════════════════════════════════

router.post('/broadcast', authMiddleware, requireRole(ADMIN, EMPLOYEE), async (req: Request, res: Response) => {
  try {
    const { title, message, link, type, roleId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'العنوان والرسالة مطلوبان' });
    }
    const result = await extNotificationService.broadcastAnnouncement(
      title,
      message,
      link,
      type || 'info',
      roleId ? Number(roleId) : 3,
    );
    res.json({ success: true, count: result.count, message: `تم إرسال الإشعار بنجاح إلى ${result.count} مستخدم` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'فشل إرسال الإشعار العام' });
  }
});

// ── FCM Token registration (Flutter mobile app) ──────────────────────────────
router.post('/fcm-token', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { token } = req.body as { token?: string };
    if (!token) return res.status(400).json({ error: 'token required' });
    await sql('UPDATE users SET fcm_token=? WHERE id=?', token, userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

