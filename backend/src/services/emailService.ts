import nodemailer from 'nodemailer';
import { getSmtpHost, getSmtpPort, getSmtpUser, getSmtpPass, getSmtpFrom } from '../config/notification';

export function isEmailEnabled(): boolean {
  return !!(getSmtpHost() && getSmtpUser() && getSmtpPass());
}

/** Parse "Name" <email> string into nodemailer-compatible object for proper Unicode/RFC 2047 encoding */
function parseFromAddress(from: string): { name: string; address: string } | string {
  if (!from) return '';
  const match = from.match(/"?([^"<]+)"?\s*<(.+?)>/);
  if (match) return { name: match[1].trim(), address: match[2].trim() };
  // Check if it's just an email
  if (from.includes('@')) return { name: '', address: from.trim() };
  return from.trim();
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: getSmtpHost(),
      port: getSmtpPort(),
      secure: getSmtpPort() === 465,
      auth: {
        user: getSmtpUser(),
        pass: getSmtpPass(),
      },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const info = await getTransporter().sendMail({
      from: parseFromAddress(getSmtpFrom()),
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent to ${to} (messageId: ${info.messageId})`);
    return true;
  } catch (err: any) {
    console.error(`❌ Failed to send email to ${to}:`, err.message);
    return false;
  }
}

export async function sendEmailOTP(email: string, otp: string, purpose: string): Promise<boolean> {
  const purposeText: Record<string, string> = {
    registration: 'التسجيل في الحساب',
    password_reset: 'إعادة تعيين كلمة المرور',
    verification: 'التحقق من البريد الإلكتروني',
  };

  const subject = `رمز التحقق — ${purposeText[purpose] || 'التحقق'}`;
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">وحدة التدريب و التطوير</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">نحو تعليم أفضل</p>
      </div>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-top: 20px; text-align: center;">
        <h2 style="color: #333; margin: 0 0 10px;">رمز التحقق</h2>
        <p style="color: #666; margin: 0 0 20px;">الغرض: ${purposeText[purpose] || 'التحقق'}</p>
        <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: monospace;">${otp}</span>
        </div>
        <p style="color: #999; font-size: 14px;">⏰ صالح لمدة 5 دقائق فقط</p>
        <p style="color: #e74c3c; font-size: 14px;">⚠️ لا تشارك هذا الرمز مع أي شخص</p>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>هذه رسالة تلقائية — لا ترد عليها</p>
      </div>
    </div>
  `;

  return sendEmail(email, subject, html);
}

export async function sendGenericEmail(email: string, subject: string, message: string): Promise<boolean> {
  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">وحدة التدريب و التطوير</h1>
        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">نحو تعليم أفضل</p>
      </div>
      <div style="background: #f8f9fa; border-radius: 12px; padding: 30px; margin-top: 20px;">
        <div style="white-space: pre-wrap; color: #333; line-height: 1.6;">${message}</div>
      </div>
      <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
        <p>هذه رسالة تلقائية — لا ترد عليها</p>
      </div>
    </div>
  `;
  return sendEmail(email, subject, html);
}
