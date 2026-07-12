import { sql } from '../db/helpers';

// ═══════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════

const WHATSAPP_BOT_URL = process.env.WHATSAPP_BOT_URL || 'http://localhost:3002';
const WHATSAPP_BOT_SECRET = process.env.WHATSAPP_BOT_SECRET || 'dev-secret-change-in-production';
const OTP_EXPIRY_MINUTES = 5;
const OTP_LENGTH = 6;

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

export interface WhatsAppStatus {
  connected: boolean;
  phone: string | null;
  uptime: number;
  messagesSent: number;
}

export interface OTPResult {
  success: boolean;
  error?: string;
}

// ═══════════════════════════════════════════════
// WhatsApp Bot API Client
// ═══════════════════════════════════════════════

async function callBotAPI(endpoint: string, body?: any): Promise<any> {
  const url = `${WHATSAPP_BOT_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-bot-secret': WHATSAPP_BOT_SECRET,
  };

  const options: RequestInit = {
    method: body ? 'POST' : 'GET',
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data: any = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'WhatsApp bot API error');
  }

  return data;
}

// ═══════════════════════════════════════════════
// Public Functions
// ═══════════════════════════════════════════════

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  try {
    const data = await callBotAPI('/status');
    return {
      connected: data.connected || false,
      phone: data.phone || null,
      uptime: data.uptime || 0,
      messagesSent: data.messagesSent || 0,
    };
  } catch (error) {
    console.error('Failed to get WhatsApp status:', error);
    return {
      connected: false,
      phone: null,
      uptime: 0,
      messagesSent: 0,
    };
  }
}

export async function sendOTP(
  phone: string,
  purpose: 'registration' | 'password_reset' | 'verification' = 'verification'
): Promise<OTPResult> {
  try {
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP in database
    await storeOTP(phone, otp, purpose);
    
    // Send via WhatsApp
    await callBotAPI('/send-otp', {
      phone,
      otp,
      purpose,
    });
    
    console.log(`OTP sent to ${phone} for ${purpose}`);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send OTP:', error.message);
    return { success: false, error: error.message };
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Get stored OTP
    const result = await sql(
      `SELECT otp, otp_expires FROM users WHERE phone=?`,
      phone
    );
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'الرقم غير مسجل' };
    }
    
    const user = result.rows[0] as any;
    
    // Check if OTP exists
    if (!user.otp) {
      return { valid: false, error: 'لم يتم إرسال رمز تحقق' };
    }
    
    // Check expiry
    const expiresAt = new Date(user.otp_expires);
    if (expiresAt < new Date()) {
      return { valid: false, error: 'انتهت صلاحية الرمز' };
    }
    
    // Verify OTP
    if (user.otp !== otp) {
      return { valid: false, error: 'الرمز غير صحيح' };
    }
    
    // Clear OTP after successful verification
    await clearOTP(phone);
    
    return { valid: true };
  } catch (error: any) {
    console.error('OTP verification error:', error.message);
    return { valid: false, error: 'خطأ في التحقق' };
  }
}

export async function resetPassword(phone: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await sql(
      'UPDATE users SET password=?, otp=NULL, otp_expires=NULL WHERE phone=?',
      hashedPassword, phone
    );
    
    return { success: true };
  } catch (error: any) {
    console.error('Password reset error:', error.message);
    return { success: false, error: 'خطأ في إعادة تعيين كلمة المرور' };
  }
}

export async function markPhoneVerified(phone: string): Promise<void> {
  await sql(
    'UPDATE users SET phone_verified=1 WHERE phone=?',
    phone
  );
}

export async function isPhoneVerified(phone: string): Promise<boolean> {
  const result = await sql(
    'SELECT phone_verified FROM users WHERE phone=?',
    phone
  );
  
  if (result.rows.length === 0) return false;
  return Number((result.rows[0] as any).phone_verified) === 1;
}

// ═══════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════

function generateOTP(): string {
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += Math.floor(Math.random() * 10).toString();
  }
  return otp;
}

async function storeOTP(phone: string, otp: string, purpose: string): Promise<void> {
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  
  await sql(
    'UPDATE users SET otp=?, otp_expires=? WHERE phone=?',
    otp, expiresAt, phone
  );
}

async function clearOTP(phone: string): Promise<void> {
  await sql(
    'UPDATE users SET otp=NULL, otp_expires=NULL WHERE phone=?',
    phone
  );
}

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    await callBotAPI('/send-message', { phone, message });
    return true;
  } catch (error: any) {
    console.error('Failed to send WhatsApp message:', error.message);
    return false;
  }
}
