import { getTelegramBotToken } from '../config/notification';

const TELEGRAM_API = 'https://api.telegram.org';

export function isTelegramEnabled(): boolean {
  return !!getTelegramBotToken();
}

function botUrl(method: string): string {
  return `${TELEGRAM_API}/bot${getTelegramBotToken()}/${method}`;
}

export async function sendTelegramMessage(chatId: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(botUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    const data: any = await res.json();
    if (data.ok) {
      console.log(`📱 Telegram message sent to chat ${chatId}`);
      return true;
    }
    console.error(`❌ Telegram API error:`, data.description);
    return false;
  } catch (err: any) {
    console.error(`❌ Failed to send Telegram message to ${chatId}:`, err.message);
    return false;
  }
}

export async function sendTelegramOTP(chatId: string, otp: string, purpose: string): Promise<boolean> {
  const purposeText: Record<string, string> = {
    registration: 'التسجيل في الحساب',
    password_reset: 'إعادة تعيين كلمة المرور',
    verification: 'التحقق من رقم الهاتف',
  };

  const message = [
    `🔐 <b>رمز التحقق الخاص بك</b>`,
    ``,
    `الغرض: ${purposeText[purpose] || 'التحقق'}`,
    `الرمز: <code>${otp}</code>`,
    ``,
    `⏰ صالح لمدة 5 دقائق فقط`,
    `⚠️ لا تشارك هذا الرمز مع أي شخص`,
    ``,
    `وحدة التدريب و التطوير`,
    `نحو تعليم أفضل`,
  ].join('\n');

  return sendTelegramMessage(chatId, message);
}

export async function sendGenericTelegram(chatId: string, message: string): Promise<boolean> {
  const formatted = message
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>');
  return sendTelegramMessage(chatId, formatted);
}

export async function getTelegramBotInfo(): Promise<{ username: string; first_name: string } | null> {
  try {
    const res = await fetch(botUrl('getMe'));
    const data: any = await res.json();
    if (data.ok) {
      return { username: data.result.username, first_name: data.result.first_name };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getTelegramUpdates(offset?: number): Promise<any[]> {
  try {
    const res = await fetch(botUrl('getUpdates') + (offset ? `?offset=${offset}` : ''));
    const data: any = await res.json();
    if (data.ok) return data.result;
    return [];
  } catch {
    return [];
  }
}
