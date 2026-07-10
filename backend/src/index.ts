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
import adminOrdersRouter from './routes/admin/orders';
import adminUsersRouter from './routes/admin/users';
import adminCertificatesRouter from './routes/admin/certificates';
import adminUnassignedRouter from './routes/admin/unassigned';

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://lms-admin-xi-seven.vercel.app',
  'https://lms-admin-x2-hims.vercel.app',
  'https://lms-user-psi.vercel.app',
  'https://lms-user-x2-hims.vercel.app',
  'https://lms-user.vercel.app',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, true); // allow all in dev
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/exports', exportsRouter);
app.use('/api/chat', chatRouter);
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', uploadRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/lectures', lecturesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/cart', cartRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/certificates', adminCertificatesRouter);
app.use('/api/admin/unassigned', adminUnassignedRouter);

const PORT = process.env.PORT || 3001;

// Ensure DB is initialized before handling requests
let dbInitPromise = initializeDatabase();
if (process.env.NODE_ENV !== 'production') {
  dbInitPromise.then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
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
