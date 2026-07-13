import { Router, Request, Response } from 'express';
import { sql } from '../db/helpers';
import { authMiddleware } from '../middleware/auth';
import * as whatsappService from '../services/whatsappService';

const router = Router();

// ═══════════════════════════════════════════════
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
      // Don't reveal if user exists or not (security)
      return res.json({ 
        success: true, 
        message: ' إذا كان الرقم مسجلاً، سيتم إرسال رمز التحقق' 
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
      res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    } else {
      res.status(500).json({ error: resetResult.error || 'فشل إعادة تعيين كلمة المرور' });
    }
  } catch (error: any) {
    console.error('Reset password error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ═══════════════════════════════════════════════
// Protected Routes (auth required)
// ═══════════════════════════════════════════════

// Send OTP for phone verification (during registration)
router.post('/send-verification', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    }
    
    const cleanedPhone = phone.replace(/\s/g, '');
    
    // Check if phone is already verified for another user
    const existingPhone = await sql(
      'SELECT id, phone_verified FROM users WHERE phone=? AND id!=?',
      cleanedPhone, req.user!.userId
    );
    
    if (existingPhone.rows.length > 0) {
      return res.status(400).json({ error: 'رقم الهاتف مسجل بالفعل بحساب آخر' });
    }
    
    // Send OTP
    const result = await whatsappService.sendOTP(cleanedPhone, 'verification');
    
    if (result.success) {
      res.json({ success: true, message: 'تم إرسال رمز التحقق' });
    } else {
      res.status(500).json({ error: 'فشل إرسال رمز التحقق' });
    }
  } catch (error: any) {
    console.error('Send verification error:', error.message);
    res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

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
