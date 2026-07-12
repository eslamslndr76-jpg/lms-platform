import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  proto,
  jidNormalizedUser,
  isJidGroup,
  makeCacheableSignalKeyStore,
  AnyMessageContent,
  isJidUser,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';

// ═══════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════

const PORT = Number(process.env.WA_BOT_PORT) || 3002;
const API_SECRET = process.env.WA_BOT_SECRET || 'dev-secret-change-in-production';
const AUTH_DIR = path.join(__dirname, '../auth');
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

// Rate limiting: 1 message per 2.5 seconds (safety)
const RATE_LIMIT_MS = 2500;
let lastSendTime = 0;

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════

interface SendMessageRequest {
  phone: string;
  message: string;
}

interface SendOTPRequest {
  phone: string;
  otp: string;
  purpose?: 'registration' | 'password_reset' | 'verification';
}

interface BotStatus {
  connected: boolean;
  phone: string | null;
  uptime: number;
  messagesSent: number;
}

// ═══════════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════════

let sock: WASocket | null = null;
let isConnected = false;
let phoneNumber: string | null = null;
let retryCount = 0;
let messagesSent = 0;
let startTime = Date.now();

// ═══════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════

function formatEgyptPhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('01')) {
    cleaned = '20' + cleaned;
  } else if (cleaned.startsWith('+20')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('20')) {
    // Already correct
  }

  return cleaned + '@s.whatsapp.net';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastSendTime;
  if (elapsed < RATE_LIMIT_MS) {
    await sleep(RATE_LIMIT_MS - elapsed);
  }
  lastSendTime = Date.now();
}

// ═══════════════════════════════════════════════
// WhatsApp Connection
// ═══════════════════════════════════════════════

async function connectWhatsApp(): Promise<void> {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, undefined as any),
    },
    printQRInTerminal: false,
    browser: ['Nadi Riada Platform', 'Chrome', '120.0.0'],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 امسح كود QR التالي بهاتفك:');
      console.log('═══════════════════════════════════════');
      qrcode.generate(qr, { small: true });
      console.log('═══════════════════════════════════════');
      console.log('⏳ في انتظار المسح...\n');
    }

    if (connection === 'open') {
      isConnected = true;
      retryCount = 0;

      if (sock && sock.user) {
        phoneNumber = sock.user.id?.split(':')[0] || null;
      }

      console.log('✅ تم الاتصال بواتساب بنجاح!');
      console.log(`📱 رقم الحساب: ${phoneNumber || 'غير معروف'}`);
      console.log(`🔗 Uptime: ${Math.floor((Date.now() - startTime) / 1000)}s`);
    }

    if (connection === 'close') {
      isConnected = false;
      phoneNumber = null;

      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`❌ تم قطع الاتصال (كود: ${statusCode})`);

      if (shouldReconnect) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          console.log(`🔄 إعادة الاتصال (${retryCount}/${MAX_RETRIES})...`);
          await sleep(RETRY_DELAY_MS);
          await connectWhatsApp();
        } else {
          console.log('⛔ تم تجاوز الحد الأقصى للمحاولات. أعد تشغيل الخدمة يدوياً.');
        }
      } else {
        console.log('👋 تم تسجيل الخروج. امسح QR code جديد للاتصال.');
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
        await sleep(2000);
        await connectWhatsApp();
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
  });
}

// ═══════════════════════════════════════════════
// Send Message Function
// ═══════════════════════════════════════════════

async function sendMessage(phone: string, message: string): Promise<boolean> {
  if (!sock || !isConnected) {
    console.error('❌ WhatsApp not connected');
    return false;
  }

  try {
    await waitForRateLimit();

    const jid = formatEgyptPhone(phone);
    await sock.sendMessage(jid, { text: message });

    messagesSent++;
    console.log(`✅ تم إرسال رسالة إلى ${phone}`);
    return true;
  } catch (error: any) {
    console.error(`❌ فشل إرسال رسالة إلى ${phone}:`, error.message);
    return false;
  }
}

async function sendOTPMessage(phone: string, otp: string, purpose: string = 'verification'): Promise<boolean> {
  const purposeText: Record<string, string> = {
    registration: 'التسجيل في الحساب',
    password_reset: 'إعادة تعيين كلمة المرور',
    verification: 'التحقق من رقم الهاتف',
  };

  const message = `🔐 رمز التحقق الخاص بك

الغرض: ${purposeText[purpose] || 'التحقق'}
الرمز: ${otp}

⏰ صالح لمدة 5 دقائق فقط
⚠️ لا تشارك هذا الرمز مع أي شخص

نادي ريادة الأعمال
جودة . ثقة . أمان`;

  return sendMessage(phone, message);
}

// ═══════════════════════════════════════════════
// Express HTTP API
// ═══════════════════════════════════════════════

const app = express();
app.use(cors());
app.use(express.json());

function requireAuth(req: Request, res: Response, next: Function) {
  const secret = req.headers['x-bot-secret'];
  if (secret !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/status', requireAuth, (_req: Request, res: Response) => {
  const status: BotStatus = {
    connected: isConnected,
    phone: phoneNumber,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    messagesSent,
  };
  res.json(status);
});

app.post('/send-otp', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phone, otp, purpose } = req.body as SendOTPRequest;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'phone and otp are required' });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'OTP must be 6 digits' });
    }

    if (!/^01[0-9]{9}$/.test(phone.replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Invalid Egyptian phone number' });
    }

    const success = await sendOTPMessage(phone, otp, purpose || 'verification');

    if (success) {
      res.json({ success: true, message: 'OTP sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send OTP' });
    }
  } catch (error: any) {
    console.error('Send OTP error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/send-message', requireAuth, async (req: Request, res: Response) => {
  try {
    const { phone, message } = req.body as SendMessageRequest;

    if (!phone || !message) {
      return res.status(400).json({ error: 'phone and message are required' });
    }

    const success = await sendMessage(phone, message);

    if (success) {
      res.json({ success: true, message: 'Message sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send message' });
    }
  } catch (error: any) {
    console.error('Send message error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════

async function start() {
  console.log('🚀 بدء تشغيل WhatsApp Bot Service...');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🔑 API Secret: ${API_SECRET.substring(0, 8)}...`);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🌐 HTTP API: http://localhost:${PORT}`);
    console.log(`📊 Status: http://localhost:${PORT}/status`);
    console.log(`\n═══════════════════════════════════════\n`);
  });

  await connectWhatsApp();
}

start().catch(console.error);
