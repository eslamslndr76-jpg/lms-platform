import express from 'express';
import cors from 'cors';
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
import adminOrdersRouter from './routes/admin/orders';
import adminUsersRouter from './routes/admin/users';
import adminCertificatesRouter from './routes/admin/certificates';

const app = express();

app.use(cors());
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
app.use('/api/groups', groupsRouter);
app.use('/api/exports', exportsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/uploads', uploadRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/certificates', certificatesRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/certificates', adminCertificatesRouter);

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'production') {
  initializeDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  initializeDatabase().catch(e => console.error('DB init error:', e.message));
}

export default app;
