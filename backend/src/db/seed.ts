import bcrypt from 'bcryptjs';
import { execute } from './turso-http';

async function count(sql: string) {
  const r = await execute(sql);
  return Number(r.rows[0]?.count || 0);
}

async function execSQL(sql: string) {
  await execute(sql);
}

export async function seed() {
  const roleCount = await count('SELECT COUNT(*) as count FROM roles');
  if (roleCount === 0) {
    await execSQL("INSERT INTO roles (id, name, permissions) VALUES (1, 'admin', '{\"all\": true}')");
    await execSQL("INSERT INTO roles (id, name, permissions) VALUES (2, 'employee', '{\"courses\":\"read,write\",\"orders\":\"read,write\",\"students\":\"read\",\"financials\":\"read\"}')");
    await execSQL("INSERT INTO roles (id, name, permissions) VALUES (3, 'student', '{\"courses\":\"read\",\"orders\":\"read\"}')");
  }

  const brandCount = await count("SELECT COUNT(*) as count FROM system_settings WHERE key='branding'");
  if (brandCount === 0) {
    const v = JSON.stringify({
      systemName: 'نظام إدارة التعلم', logoHeader: '', logoFooter: '', favicon: '',
      primaryColor: '#2563eb', secondaryColor: '#7c3aed',
      sloganAr: 'نحو تعليم أفضل', sloganEn: 'Towards Better Learning', messageFooter: '',
    });
    await execSQL(`INSERT INTO system_settings (key,value) VALUES ('branding','${v.replace(/'/g, "''")}')`);
  }

  const aiCount = await count("SELECT COUNT(*) as count FROM system_settings WHERE key='aiKeys'");
  if (aiCount === 0) {
    await execSQL("INSERT INTO system_settings (key,value) VALUES ('aiKeys','[]')");
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
