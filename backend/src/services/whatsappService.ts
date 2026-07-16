import { sql } from '../db/helpers';
import {
  getBotUrl,
  getBotSecret,
  getBotApiHeaders,
  CODE_TTL,
  RECONNECT_RETRIES,
  RECONNECT_DELAY_BASE,
} from '../config/whatsapp';

// ═══════════════════════════════════════════════
// Internal state
// ═══════════════════════════════════════════════

let botConnected = false;
let botReady = false;
let lastHealthCheck = 0;
let messagesSent = 0;
let uptimeStart = Date.now();
let botConnectionState: string = 'disconnected';
let botReconnecting = false;
let botRetryCount = 0;
let lastConnectedAt: number | null = null;

const OTP_TTL = 300; // 5 minutes
// Cache TTL: 10 seconds (was 30s) — faster detection of disconnections
const HEALTH_CACHE_TTL = 10_000;

// ═══════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════

async function fetchBot(path: string, opts: RequestInit = {}): Promise<any> {
  const url = `${getBotUrl()}${path}`;
  const headers = { ...getBotApiHeaders(), ...(opts.headers || {}) };
  const res = await fetch(url, { ...opts, headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bot ${path} failed (${res.status}): ${body}`);
  }
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════
// Exported: sendWhatsAppMessage (core send)
// ═══════════════════════════════════════════════

export async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  try {
    await ensureBotConnected();
    const cleaned = phone.replace(/[\s\-()]/g, '');
    const result = await fetchBot('/send-message', {
      method: 'POST',
      body: JSON.stringify({ phone: cleaned, message }),
    });
    if (result.ok || result.success) {
      messagesSent++;
      return true;
    }
    console.error('[WA] Send failed:', result);
    return false;
  } catch (error: any) {
    console.error('[WA] Send error:', error.message);
    return false;
  }
}

// ═══════════════════════════════════════════════
// Exported: ensureBotConnected
// ═══════════════════════════════════════════════

export async function ensureBotConnected(): Promise<void> {
  if (botConnected && botReady && Date.now() - lastHealthCheck < HEALTH_CACHE_TTL) return;

  try {
    // Use deep health check — returns 200 only if WhatsApp is truly connected
    const st = await fetchBot('/health/deep');
    botConnected = st.connected || false;
    botReady = st.ready || false;
    botConnectionState = st.connectionState || 'unknown';
    botReconnecting = st.reconnecting || false;
    botRetryCount = st.retryCount || 0;
    lastConnectedAt = st.lastConnectedAt || null;
    lastHealthCheck = Date.now();
    return;
  } catch {
    // Bot might be sleeping or unreachable
  }

  botConnected = false;
  botReady = false;
  botConnectionState = 'disconnected';
  botReconnecting = false;
}

// ═══════════════════════════════════════════════
// Exported: getWhatsAppStatus
// ═══════════════════════════════════════════════

export async function getWhatsAppStatus(): Promise<{
  connected: boolean;
  ready: boolean;
  uptime: number;
  messagesSent: number;
  phone: string | null;
  connectionState: string;
  reconnecting: boolean;
  retryCount: number;
  lastConnectedAt: number | null;
}> {
  try {
    const st = await fetchBot('/health/deep');
    botConnected = st.connected || false;
    botReady = st.ready || false;
    botConnectionState = st.connectionState || 'unknown';
    botReconnecting = st.reconnecting || false;
    botRetryCount = st.retryCount || 0;
    lastConnectedAt = st.lastConnectedAt || null;
    lastHealthCheck = Date.now();
    return {
      connected: botConnected,
      ready: botReady,
      uptime: Math.floor((Date.now() - uptimeStart) / 1000),
      messagesSent,
      phone: st.phone || null,
      connectionState: botConnectionState,
      reconnecting: botReconnecting,
      retryCount: botRetryCount,
      lastConnectedAt,
    };
  } catch {
    botConnected = false;
    botReady = false;
    botConnectionState = 'disconnected';
  }

  return {
    connected: botConnected,
    ready: botReady,
    uptime: Math.floor((Date.now() - uptimeStart) / 1000),
    messagesSent,
    phone: null,
    connectionState: botConnectionState,
    reconnecting: botReconnecting,
    retryCount: botRetryCount,
    lastConnectedAt,
  };
}

// ═══════════════════════════════════════════════
// Exported: sendOTP
// ═══════════════════════════════════════════════

export async function sendOTP(
  phone: string,
  purpose: 'password_reset' | 'verification' = 'password_reset',
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleaned = phone.replace(/[\s\-()]/g, '');

    // Rate limit: one OTP per 60s
    const recent = await sql(
      'SELECT created_at FROM otp_codes WHERE phone=? ORDER BY id DESC LIMIT 1',
      cleaned,
    );
    if (recent.rows.length > 0) {
      const last = new Date((recent.rows[0] as any).created_at).getTime();
      if (Date.now() - last < 60000) {
        return { success: false, error: 'انتظر دقيقة قبل طلب رمز جديد' };
      }
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));

    // Store in DB
    await sql(
      'INSERT INTO otp_codes (phone, code, purpose, expires_at) VALUES (?,?,?, datetime("now","+' + OTP_TTL + ' seconds"))',
      cleaned,
      code,
      purpose,
    );

    // Build OTP message
    const purposeText = purpose === 'password_reset' ? 'إعادة تعيين كلمة المرور' : 'التحقق من رقم الهاتف';
    const message = `🔐 رمز التحقق الخاص بك هو: ${code}\n\nالغرض: ${purposeText}\nالرمز صالح لمدة ${OTP_TTL / 60} دقائق.\n\n⚠️ لا تشارك هذا الرمز مع أي شخص.\n\nنادي ريادة الأعمال\nنحو تعليم أفضل`;

    const sent = await sendWhatsAppMessage(cleaned, message);
    if (sent) {
      return { success: true };
    }
    return { success: false, error: 'فشل إرسال رمز التحقق عبر واتساب' };
  } catch (error: any) {
    console.error('[WA] sendOTP error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════
// Exported: verifyOTP
// ═══════════════════════════════════════════════

export async function verifyOTP(
  phone: string,
  code: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const cleaned = phone.replace(/[\s\-()]/g, '');

    const result = await sql(
      'SELECT id FROM otp_codes WHERE phone=? AND code=? AND purpose IN ("password_reset","verification") AND expires_at > datetime("now") ORDER BY id DESC LIMIT 1',
      cleaned,
      code,
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'الرمز غير صحيح أو منتهي الصلاحية' };
    }

    // Delete used OTP
    await sql('DELETE FROM otp_codes WHERE id=?', (result.rows[0] as any).id);

    return { valid: true };
  } catch (error: any) {
    console.error('[WA] verifyOTP error:', error.message);
    return { valid: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════
// Exported: resetPassword
// ═══════════════════════════════════════════════

export async function resetPassword(
  phone: string,
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleaned = phone.replace(/[\s\-()]/g, '');

    // Hash password using crypto
    const { createHash } = await import('crypto');
    const hashed = createHash('sha256').update(newPassword).digest('hex');

    const result = await sql(
      'UPDATE users SET password=? WHERE phone=?',
      hashed,
      cleaned,
    );

    if (result.rowsAffected > 0) {
      return { success: true };
    }
    return { success: false, error: 'لم يتم العثور على المستخدم' };
  } catch (error: any) {
    console.error('[WA] resetPassword error:', error.message);
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════
// Exported: markPhoneVerified
// ═══════════════════════════════════════════════

export async function markPhoneVerified(phone: string): Promise<void> {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  await sql('UPDATE users SET phone_verified=1 WHERE phone=?', cleaned);
}

// ═══════════════════════════════════════════════
// Exported: getBotQR
// ═══════════════════════════════════════════════

export async function getBotQR(): Promise<{ available: boolean; qr?: string; message?: string }> {
  try {
    const result = await fetchBot('/qr-json');
    return {
      available: !!(result.qr || result.success),
      qr: result.qr,
      message: result.message,
    };
  } catch (error: any) {
    return { available: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════
// Exported: logoutBot
// ═══════════════════════════════════════════════

export async function logoutBot(): Promise<{ success: boolean; message?: string }> {
  try {
    const result = await fetchBot('/logout', { method: 'POST' });
    botConnected = false;
    botReady = false;
    return { success: true, message: result.message || 'تم فصل الاتصال' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// ═══════════════════════════════════════════════
// Exported: getQRCodeSmart (with retry + fallback)
// ═══════════════════════════════════════════════

export async function getQRCodeSmart(): Promise<{
  available: boolean;
  qr?: string;
  message?: string;
  method?: string;
}> {
  // Level 1: try direct QR
  try {
    const qr = await getBotQR();
    if (qr.available && qr.qr) {
      return { available: true, qr: qr.qr, method: 'qr' };
    }
  } catch { /* continue */ }

  // Level 2: full reset and retry
  try {
    await fetchBot('/logout', { method: 'POST' });
    await sleep(3000);
    const qr2 = await getBotQR();
    if (qr2.available && qr2.qr) {
      return { available: true, qr: qr2.qr, method: 'qr-after-reset' };
    }
  } catch { /* continue */ }

  return { available: false, message: 'تعذر الحصول على رمز الاتصال. حاول مرة أخرى.' };
}
