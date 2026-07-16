import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import * as whatsappService from '../services/whatsappService';
import { sendWhatsAppNotification } from '../services/whatsappNotificationService';
import { getCronSecret, isValidCronRequest } from '../config/whatsapp';

const router = Router();

// ═══════════════════════════════════════════════
// Keep-alive for Bonto free tier (prevents bot sleep after 30min)
// ═══════════════════════════════════════════════

router.get('/keep-alive', async (req: Request, res: Response) => {
  try {
    // Validate cron secret if configured
    if (!isValidCronRequest(req)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    
    const result = await whatsappService.getWhatsAppStatus();
    console.log('[WA Keep-Alive]', {
      timestamp: new Date().toISOString(),
      connected: result.connected,
      ready: result.ready,
      uptime: result.uptime,
      messagesSent: result.messagesSent
    });
    
    // Alert if disconnected
    if (!result.connected || !result.ready) {
      console.warn('[WA ALERT] Bot disconnected!', {
        connectionState: result.connectionState,
        reconnecting: result.reconnecting,
        retryCount: result.retryCount,
      });
    }
    
    res.json({ ok: true, connected: result.connected, uptime: result.uptime, messagesSent: result.messagesSent });
  } catch (error: any) {
    console.error('Keep-alive error:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ══════════════════════════════════════════════
// Public Routes (no auth required)
// ═══════════════════════════════════════════════

// Send OTP for password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    }
    
    // Validate phone format
    const cleanedPhone = phone.replace(/\s/g, '');
    if (!/^01[0-9]{9}$/.test(cleanedPhone)) {
      return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
    }
    
    // Check if user exists
    const user = await sql(
      'SELECT id, name FROM users WHERE phone=?',
      cleanedPhone
    );
    
    if (user.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'الرقم غير مسجل في المنصة، أنشئ حساباً أولاً' 
      });
    }
    
    // Send OTP
    const result = await whatsappService.sendOTP(cleanedPhone, 'password_reset');
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'تم إرسال رمز التحقق إلى رقم الهاتف' 
      });
    } else {
      res.status(500).json({ error: 'فشل إرسال رمز التحقق' });
    }
  } catch (error: any) {
    console.error('Forgot password error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════════
// Send OTP for registration/verification (allows NEW numbers)
// ══════════════════════════════════════════════

router.post('/send-verification', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    }
    
    // Validate phone format
    const cleanedPhone = phone.replace(/\s/g, '');
    if (!/^01[0-9]{9}$/.test(cleanedPhone)) {
      return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
    }
    
    // Send OTP for registration/verification (allows new numbers)
    const result = await whatsappService.sendOTP(cleanedPhone, 'verification');
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'تم إرسال رمز التحقق إلى رقم الهاتف' 
      });
    } else {
      res.status(500).json({ error: 'فشل إرسال رمز التحقق' });
    }
  } catch (error: any) {
    console.error('Send verification error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════════
// Smart QR endpoint with retry & fallback
// ══════════════════════════════════════════════

router.get('/qr-smart', async (req: Request, res: Response) => {
  try {
    const result = await whatsappService.getQRCodeSmart();
    res.json(result);
  } catch (error: any) {
    console.error('QR Smart error:', error.message);
    res.status(500).json({ available: false, message: 'خطأ في الخادم' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'رقم الهاتف والرمز مطلوبان' });
    }
    
    const cleanedPhone = phone.replace(/\s/g, '');
    
    // Verify OTP
    const result = await whatsappService.verifyOTP(cleanedPhone, otp);
    
    if (result.valid) {
      res.json({ success: true, message: 'تم التحقق بنجاح' });
    } else {
      res.status(400).json({ error: result.error || 'الرمز غير صحيح' });
    }
  } catch (error: any) {
    console.error('Verify OTP error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Reset password after OTP verification
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { phone, otp, newPassword } = req.body;
    
    if (!phone || !otp || !newPassword) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }
    
    const cleanedPhone = phone.replace(/\s/g, '');
    
    // Verify OTP first
    const otpResult = await whatsappService.verifyOTP(cleanedPhone, otp);
    
    if (!otpResult.valid) {
      return res.status(400).json({ error: otpResult.error || 'الرمز غير صحيح' });
    }
    
    // Reset password
    const resetResult = await whatsappService.resetPassword(cleanedPhone, newPassword);
    
    if (resetResult.success) {
      // Send password reset confirmation notification — await with fast-fail (max ~4s)
      const user = await sql('SELECT id FROM users WHERE phone=?', cleanedPhone);
      if (user.rows.length > 0) {
        await sendWhatsAppNotification(Number((user.rows[0] as any).id), 'password_reset_done', {}).catch(e => console.error('[WA Notify] password_reset_done failed:', e.message));
      }
      res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    } else {
      res.status(500).json({ error: resetResult.error || 'فشل إعادة تعيين كلمة المرور' });
    }
  } catch (error: any) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ══════════════════════════════════════════════
// Protected Routes (auth required)
// ══════════════════════════════════════════════

// Verify phone number
router.post('/verify-phone', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
      return res.status(400).json({ error: 'رقم الهاتف والرمز مطلوبان' });
    }
    
    const cleanedPhone = phone.replace(/\s/g, '');
    
    // Verify OTP
    const result = await whatsappService.verifyOTP(cleanedPhone, otp);
    
    if (result.valid) {
      // Mark phone as verified
      await whatsappService.markPhoneVerified(cleanedPhone);
      
      // Update user's phone if different
      await sql(
        'UPDATE users SET phone=? WHERE id=?',
        cleanedPhone, req.user!.userId
      );
      
      res.json({ success: true, message: 'تم التحقق من رقم الهاتف بنجاح' });
    } else {
      res.status(400).json({ error: result.error || 'الرمز غير صحيح' });
    }
  } catch (error: any) {
    console.error('Verify phone error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Get WhatsApp status
router.get('/status', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const status = await whatsappService.getWhatsAppStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Get WhatsApp status error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Deep health check — for admin dashboard real-time monitoring
router.get('/health', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const status = await whatsappService.getWhatsAppStatus();
    const httpCode = status.connected && status.ready ? 200 : 503;
    res.status(httpCode).json({
      connected: status.connected,
      ready: status.ready,
      connectionState: status.connectionState,
      reconnecting: status.reconnecting,
      retryCount: status.retryCount,
      lastConnectedAt: status.lastConnectedAt,
      phone: status.phone,
    });
  } catch (error: any) {
    console.error('WhatsApp health check error:', error.message);
    res.status(503).json({
      connected: false,
      ready: false,
      connectionState: 'disconnected',
      reconnecting: false,
      retryCount: 0,
      lastConnectedAt: null,
      phone: null,
    });
  }
});

// Get QR code from bot (for admin pairing)
router.get('/bot/qr', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const qr = await whatsappService.getBotQR();
    res.json(qr);
  } catch (error: any) {
    console.error('Get bot QR error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Logout bot (for admin re-pairing)
router.post('/bot/logout', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const result = await whatsappService.logoutBot();
    if (result.success) {
      res.json({ success: true, message: 'تم فصل الاتصال بنجاح' });
    } else {
      res.status(500).json({ error: result.message || 'فشل فصل الاتصال' });
    }
  } catch (error: any) {
    console.error('Bot logout error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
