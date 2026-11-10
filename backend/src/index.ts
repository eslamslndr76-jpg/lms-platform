import express from 'express';
import cors from 'cors';
import path from 'path';
import { initializeDatabase } from './db/connection';
import { sql } from './db/helpers';
import authRouter from './routes/auth';
import settingsRouter from './routes/settings';
import coursesRouter from './routes/courses';
import ordersRouter from './routes/orders';
import categoriesRouter from './routes/categories';
import groupsRouter from './routes/groups';
import placesRouter from './routes/places';
import exportsRouter from './routes/exports';
import chatRouter from './routes/chat';
import uploadRouter from './routes/uploads';
import rolesRouter from './routes/roles';
import certificatesRouter from './routes/certificates';
import lecturesRouter from './routes/lectures';
import cartRouter from './routes/cart';
import aiSettingsRouter from './routes/aiSettings';
import notificationsRouter from './routes/notifications';
import attendanceRouter from './routes/attendance';
import surveysRouter from './routes/surveys';
import adminOrdersRouter from './routes/admin/orders';
import adminUsersRouter from './routes/admin/users';
import adminCertificatesRouter from './routes/admin/certificates';
import adminUnassignedRouter from './routes/admin/unassigned';
import adminProposalsRouter from './routes/admin/proposals';
import paymentMethodsRouter from './routes/paymentMethods';
import adminPaymentMethodsRouter from './routes/admin/paymentMethods';
import instructorRouter from './routes/instructor';
import { warmNotificationCache } from './config/notification';
import { runSurveyReminderSweep } from './services/surveyService';
import { expireStaleBookings } from './services/orderService';
import { cleanupOldNotifications } from './services/notificationService';

const app = express();

const defaultOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  process.env.ADMIN_URL || '',
  'https://lms-admin-xi-seven.vercel.app',
  'https://lms-admin-x2-hims.vercel.app',
  'https://lms-admin-drk2id8pb-x2-hims.vercel.app',
  'https://lms-user-psi.vercel.app',
  'https://lms-user-x2-hims.vercel.app',
  'https://lms-user.vercel.app',
];

// Extra origins can be added at runtime without a redeploy:
//   ALLOWED_ORIGINS="https://a.com,https://b.com"
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([...defaultOrigins, ...envOrigins].filter(Boolean).map((o) => o.replace(/\/$/, ''))),
);

const isProduction = process.env.NODE_ENV === 'production';
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header: server-to-server calls, curl, native apps — always allowed.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Any localhost port during local development.
    if (!isProduction && LOCAL_ORIGIN.test(origin)) return cb(null, true);
    // Unknown origin: respond without CORS headers so the browser blocks it.
    console.warn(`[CORS] Blocked origin: ${origin}`);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Fail loudly in logs when a production deployment is missing its JWT secret
// (auth middleware would otherwise fall back to a well-known dev value).
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('[SECURITY] JWT_SECRET is not set — using the insecure fallback secret.');
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/branding', async (_req, res) => {
  try {
    const result = await sql("SELECT value FROM system_settings WHERE key='branding'");
    if (result.rows.length > 0) return res.json(JSON.parse(result.rows[0].value as string));
    res.json(null);
  } catch {
    res.status(500).json({ error: 'Failed to fetch branding' });
  }
});



app.use('/api/auth', authRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/ai-settings', aiSettingsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/places', placesRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/chat', chatRouter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', uploadRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/lectures', lecturesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/surveys', surveysRouter);
app.use('/api/cart', cartRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/certificates', adminCertificatesRouter);
app.use('/api/admin/unassigned', adminUnassignedRouter);
app.use('/api/admin/proposals', adminProposalsRouter);
app.use('/api/payment-methods', paymentMethodsRouter);
app.use('/api/admin/payment-methods', adminPaymentMethodsRouter);
app.use('/api/instructor', instructorRouter);

const PORT = process.env.PORT || 3001;

// Ensure DB is initialized before handling requests
const dbInitPromise = initializeDatabase().then(() => {
  warmNotificationCache().catch(e => console.error('Notification cache warm failed:', e.message));
  // Drop in-app notifications older than the 30-day retention window.
  cleanupOldNotifications(true).catch(e => console.error('Notification cleanup failed:', e.message));
  // Survey reminders (2 and 5 days after completion by default) are idempotent.
  runSurveyReminderSweep().catch(e => console.error('Survey reminder sweep failed:', e.message));
  // Cancel unpaid bookings older than the admin-configured booking window.
  expireStaleBookings().catch(e => console.error('Booking expiry sweep failed:', e.message));
});
if (process.env.NODE_ENV !== 'production') {
  dbInitPromise.then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
    // Keep reminders flowing while the dev server stays up.
    const timer = setInterval(() => {
      runSurveyReminderSweep().catch(e => console.error('Survey reminder sweep failed:', e.message));
      expireStaleBookings().catch(e => console.error('Booking expiry sweep failed:', e.message));
    }, 6 * 60 * 60 * 1000);
    timer.unref?.();
  });
} else {
  dbInitPromise.catch(e => console.error('DB init error:', e.message));
}

// Middleware to wait for DB init on every request
app.use(async (_req: any, _res: any, next: any) => {
  try { await dbInitPromise; } catch { /* ignore */ }
  next();
});

export default app;
