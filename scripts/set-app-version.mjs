/**
 * set-app-version.mjs
 * Safe UTF-8 script to update app-version settings on the live backend.
 * Usage: node scripts/set-app-version.mjs
 *
 * Env required: ADMIN_EMAIL, ADMIN_PASSWORD, BACKEND_URL (or defaults below)
 */

const BACKEND = process.env.BACKEND_URL || 'https://lms-backend-flame-seven.vercel.app';
const EMAIL   = process.env.ADMIN_EMAIL    || 'admin@lms.com';
const PASS    = process.env.ADMIN_PASSWORD || 'admin123';

// ─── Edit these values before running ───────────────────────────────────────
const VERSION_SETTINGS = {
  latestVersion : '1.0.8',
  buildNumber   : 9,
  forceUpdate   : false,
  title         : 'تحديث جديد متوفر — 1.0.8',
  message       : 'الإصدار 1.0.8 جاهز: شهادة تلقائية بعد الاستبيان، تصميم Material 3، شيت الحضور بالغائبين.',
  downloadUrl   : 'https://lms-user.vercel.app/download',
  apkDirectUrl  : 'https://github.com/eslamslndr76-jpg/lms-platform/releases/download/v1.0.8/app-release-1.0.8.apk',
};
// ────────────────────────────────────────────────────────────────────────────

async function json(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// 1. Login
const loginRes = await fetch(`${BACKEND}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASS }),
});
const { token } = await json(loginRes);
if (!token) { console.error('Login failed'); process.exit(1); }
console.log('✅ Logged in');

// 2. Update app-version (Node fetch uses UTF-8 by default)
const updateRes = await fetch(`${BACKEND}/api/settings/app-version`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(VERSION_SETTINGS),
});
const updateData = await json(updateRes);
console.log('✅ Updated:', JSON.stringify(updateData.data, null, 2));
if (updateData.broadcastCount != null)
  console.log(`📣 Broadcast sent to ${updateData.broadcastCount} users`);

// 3. Optional manual re-broadcast
const args = process.argv.slice(2);
if (args.includes('--broadcast')) {
  const bRes = await fetch(`${BACKEND}/api/settings/app-version/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}',
  });
  const bData = await json(bRes);
  console.log(`📣 Manual broadcast: ${bData.message}`);
}
