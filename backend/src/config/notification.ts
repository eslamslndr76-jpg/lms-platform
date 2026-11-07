// Notification configuration — reads from DB first, falls back to env vars
// Settings are cached in memory for 60 seconds to avoid hitting DB on every call

import { sql } from '../db/helpers';
import { createHash } from 'crypto';

interface NotificationSettings {
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  telegramBotToken: string;
  telegramBotUsername: string;
}

let cachedSettings: NotificationSettings | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

async function loadSettings(): Promise<NotificationSettings> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSettings;
  }

  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='notification'");
    if (result.rows.length > 0) {
      const parsed = JSON.parse(result.rows[0].value as string);
      cachedSettings = {
        smtpUser: parsed.smtpUser || process.env.SMTP_USER || '',
        smtpPass: parsed.smtpPass || process.env.SMTP_PASS || '',
        smtpFrom: parsed.smtpFrom || process.env.SMTP_FROM || `"وحدة التدريب و التطوير" <${parsed.smtpUser || process.env.SMTP_USER || ''}>`,
        telegramBotToken: parsed.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '',
        telegramBotUsername: parsed.telegramBotUsername || process.env.TELEGRAM_BOT_USERNAME || '',
      };
      cacheTimestamp = now;
      return cachedSettings;
    }
  } catch {
    // DB not ready yet — fall through to env vars
  }

  // No DB settings — use env vars
  cachedSettings = {
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || `"وحدة التدريب و التطوير" <${process.env.SMTP_USER || ''}>`,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  };
  cacheTimestamp = now;
  return cachedSettings;
}

/** Call after saving notification settings to force re-read from DB */
export function invalidateNotificationCache(): void {
  cachedSettings = null;
  cacheTimestamp = 0;
}

// ─── Sync getters (use cached, don't await) ──────
// These call loadSettings() but since it's async and returns cached data most of the time,
// we use a pattern where we pre-fetch and cache synchronously.

let syncCache: NotificationSettings | null = null;

/** Must be called once at startup to warm the cache */
export async function warmNotificationCache(): Promise<void> {
  syncCache = await loadSettings();
}

// For the actual getters, we use async pattern — but most callers need sync.
// Strategy: use cached value if available, otherwise fire-and-forget load.
function getCached(): NotificationSettings {
  if (syncCache) return syncCache;
  // Fallback to env vars immediately while DB loads
  return {
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpFrom: process.env.SMTP_FROM || '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || '',
  };
}

// ─── Fixed SMTP config (Gmail) ─────────────────────
export const SMTP_HOST = 'smtp.gmail.com';
export const SMTP_PORT = 587;

// ─── Email (SMTP) ───────────────────────────────────
export function getSmtpHost(): string { return SMTP_HOST; }
export function getSmtpPort(): number { return SMTP_PORT; }
export function getSmtpUser(): string { return getCached().smtpUser; }
export function getSmtpPass(): string { return getCached().smtpPass; }
export function getSmtpFrom(): string { return getCached().smtpFrom || `"وحدة التدريب و التطوير" <${getCached().smtpUser}>`; }
export function isEmailEnabled(): boolean { return !!(getSmtpUser() && getSmtpPass()); }

// ─── Telegram Bot API ───────────────────────────────
export function getTelegramBotToken(): string { return getCached().telegramBotToken; }
export function getTelegramBotUsername(): string { return getCached().telegramBotUsername; }
export function isTelegramEnabled(): boolean { return !!getTelegramBotToken(); }

// ─── Frontend URL (for deep links) ──────────────────
export function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || 'https://lms-user-psi.vercel.app').replace(/\/+$/, '');
}

// ─── Backend (public API) URL — used for Telegram webhooks ──
// Must be the API origin, NOT the frontend origin, otherwise Telegram
// posts updates to the Next.js app and user linking silently fails.
export function getBackendUrl(): string {
  const raw = process.env.BACKEND_URL || process.env.API_URL || process.env.PUBLIC_API_URL || '';
  return raw.replace(/\/+$/, '');
}

// Secret used to authenticate incoming Telegram webhook calls.
// Deterministic (derived from the bot token) so every serverless instance
// validates against the same value without shared state.
export function getTelegramWebhookSecret(): string {
  const explicit = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (explicit) return explicit;
  const token = getTelegramBotToken();
  if (!token) return '';
  return createHash('sha256').update(`telegram-webhook:${token}`).digest('hex').slice(0, 48);
}

// ─── OTP ────────────────────────────────────────────
export const OTP_TTL_MINUTES = 5;
export const OTP_LENGTH = 6;

// ─── Cron Secret ────────────────────────────────────
export function getCronSecret(): string {
  return process.env.CRON_SECRET || '';
}

export function isValidCronRequest(req: any): boolean {
  const secret = req.headers['x-cron-secret'];
  return !!secret && secret === getCronSecret();
}

// ─── Async getter for routes ────────────────────────
export async function getNotificationSettings(): Promise<NotificationSettings> {
  return loadSettings();
}
