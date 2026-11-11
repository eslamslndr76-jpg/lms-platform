import bcrypt from 'bcryptjs';
import { execute } from './turso-http';
import { DEFAULT_LOGO_DATA_URL } from '../config/brandLogo';

async function count(sql: string) {
  const r = await execute(sql);
  return Number(r.rows[0]?.count || 0);
}

async function execSQL(sql: string) {
  await execute(sql);
}

/**
 * Default permission matrix for the built-in employee role. Account, role and
 * settings management stay admin-only, so `employees`/`settings` are absent.
 */
const DEFAULT_EMPLOYEE_PERMISSIONS: Record<string, string> = {
  dashboard: 'read',
  courses: 'read,write',
  categories: 'read,write',
  orders: 'read,write',
  students: 'read,write',
  groups: 'read,write',
  proposals: 'read,write',
  places: 'read,write',
  certificates: 'read,write',
  financials: 'read',
};

/** The untouched permissions shipped before the permission matrix existed. */
const LEGACY_EMPLOYEE_PERMISSIONS: Record<string, string> = {
  courses: 'read,write',
  orders: 'read,write',
  students: 'read',
  financials: 'read',
};

function samePermissions(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key, index) => key === bKeys[index] && String(a[key]) === String(b[key]));
}

/**
 * One-time upgrade: give the built-in employee role the full operational
 * matrix. Only runs while the role still holds the untouched legacy value, so
 * a customised role is never overwritten.
 */
async function upgradeLegacyEmployeeRole() {
  try {
    const result = await execute('SELECT permissions FROM roles WHERE id=2');
    const row = result.rows[0] as { permissions?: string } | undefined;
    if (!row?.permissions) return;
    const current = JSON.parse(row.permissions) as Record<string, unknown>;
    if (!samePermissions(current, LEGACY_EMPLOYEE_PERMISSIONS)) return;
    await execute(
      `UPDATE roles SET permissions='${JSON.stringify(DEFAULT_EMPLOYEE_PERMISSIONS)}' WHERE id=2`,
    );
  } catch {
    /* role table or permissions value not available yet — ignore */
  }
}

/**
 * Grant the new `places` section to the built-in employee role when it already
 * has group management. Customised roles are left untouched (the key is only
 * added when it does not exist yet).
 */
async function ensurePlacesPermission() {
  try {
    const result = await execute('SELECT permissions FROM roles WHERE id=2');
    const row = result.rows[0] as { permissions?: string } | undefined;
    if (!row?.permissions) return;
    const current = JSON.parse(row.permissions) as Record<string, unknown>;
    if (current.all || current.places !== undefined) return;
    if (!String(current.groups || '').includes('write')) return;
    const next = { ...current, places: 'read,write' };
    await execute(
      `UPDATE roles SET permissions='${JSON.stringify(next).replace(/'/g, "''")}' WHERE id=2`,
    );
  } catch {
    /* role table or permissions value not available yet — ignore */
  }
}

/**
 * Grant the new `proposals` section to the built-in employee role when it
 * already manages groups. Customised roles are left untouched.
 */
async function ensureProposalsPermission() {
  try {
    const result = await execute('SELECT permissions FROM roles WHERE id=2');
    const row = result.rows[0] as { permissions?: string } | undefined;
    if (!row?.permissions) return;
    const current = JSON.parse(row.permissions) as Record<string, unknown>;
    if (current.all || current.proposals !== undefined) return;
    if (!String(current.groups || '').includes('write')) return;
    const next = { ...current, proposals: 'read,write' };
    await execute(
      `UPDATE roles SET permissions='${JSON.stringify(next).replace(/'/g, "''")}' WHERE id=2`,
    );
  } catch {
    /* role table or permissions value not available yet — ignore */
  }
}

/**
 * Instructors get their own account type with no admin privileges. The role is
 * created on boot when missing so existing databases pick it up automatically.
 */
async function ensureInstructorRole() {
  try {
    const existing = await execute("SELECT id FROM roles WHERE name='instructor' OR id=4");
    if (existing.rows.length > 0) return;
    await execute("INSERT INTO roles (id, name, permissions) VALUES (4, 'instructor', '{}')");
  } catch {
    /* role table not available yet — ignore */
  }
}

export async function seed() {
  const roleCount = await count('SELECT COUNT(*) as count FROM roles');
  if (roleCount === 0) {
    await execSQL("INSERT INTO roles (id, name, permissions) VALUES (1, 'admin', '{\"all\": true}')");
    await execSQL(`INSERT INTO roles (id, name, permissions) VALUES (2, 'employee', '${JSON.stringify(DEFAULT_EMPLOYEE_PERMISSIONS)}')`);
    await execSQL("INSERT INTO roles (id, name, permissions) VALUES (3, 'student', '{\"courses\":\"read\",\"orders\":\"read\"}')");
  }
  await upgradeLegacyEmployeeRole();
  await ensurePlacesPermission();
  await ensureProposalsPermission();
  await ensureInstructorRole();

  const brandCount = await count("SELECT COUNT(*) as count FROM system_settings WHERE key='branding'");
  if (brandCount === 0) {
    const v = JSON.stringify({
      systemName: 'وحدة التدريب و التطوير',
      logoHeader: DEFAULT_LOGO_DATA_URL, logoFooter: DEFAULT_LOGO_DATA_URL, favicon: '',
      primaryColor: '#2563eb', secondaryColor: '#7c3aed',
      sloganAr: 'نحو تعليم أفضل', sloganEn: 'Towards Better Learning',
      messageFooter:
        'هذه المنصة مقدمة من وحدة التدريب و التطوير بالتعاون مع المعهد العالي للعلوم الإدارية بالقطامية (HIMS)',
    });
    await execSQL(`INSERT INTO system_settings (key,value) VALUES ('branding','${v.replace(/'/g, "''")}')`);
  }

  const aiCount = await count("SELECT COUNT(*) as count FROM system_settings WHERE key='aiKeys'");
  if (aiCount === 0) {
    await execSQL("INSERT INTO system_settings (key,value) VALUES ('aiKeys','[]')");
  }

  // Seed the initial payment methods once. Numbers stay empty until the admin
  // fills them, and digital methods without a number are hidden from students.
  const paymentCount = await count('SELECT COUNT(*) as count FROM payment_methods');
  if (paymentCount === 0) {
    await execSQL(`INSERT INTO payment_methods (key, label, kind, account_number, account_name, instructions, is_active, sort_order) VALUES
      ('wallet', 'محفظة إلكترونية', 'digital', '', '', '', 1, 1),
      ('instapay', 'إنستاباي', 'digital', '', '', '', 1, 2),
      ('cash', 'كاش في خزنة المعهد', 'cash', '', '', '', 1, 3)`);
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lms.com';
  const adminCount = await count(`SELECT COUNT(*) as count FROM users WHERE email='${adminEmail.replace(/'/g, "''")}'`);
  if (adminCount === 0) {
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hashed = await bcrypt.hash(password, 10);
    await execSQL(`INSERT INTO users (name,email,password,role_id) VALUES ('Admin','${adminEmail.replace(/'/g, "''")}','${hashed.replace(/'/g, "''")}',1)`);
    console.log(`Admin user created: ${adminEmail}`);
  }
}
