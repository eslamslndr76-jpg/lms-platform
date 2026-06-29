import bcrypt from 'bcryptjs';
import { sql } from './helpers';

export async function seed() {
  const roleCount = (await sql('SELECT COUNT(*) as count FROM roles')).rows[0].count;
  if (roleCount === 0) {
    await sql(`INSERT INTO roles (id, name, permissions) VALUES
      (1, 'admin', '{"all": true}'),
      (2, 'employee', '{"courses":"read,write","orders":"read,write","students":"read","financials":"read"}'),
      (3, 'student', '{"courses":"read","orders":"read"}')`);
  }

  const brandCount = (await sql("SELECT COUNT(*) as count FROM system_settings WHERE key='branding'")).rows[0].count;
  if (brandCount === 0) {
    const v = JSON.stringify({
      systemName: 'نظام إدارة التعلم', logoHeader: '', logoFooter: '', favicon: '',
      primaryColor: '#2563eb', secondaryColor: '#7c3aed',
      sloganAr: 'نحو تعليم أفضل', sloganEn: 'Towards Better Learning', messageFooter: '',
    });
    await sql(`INSERT INTO system_settings (key,value) VALUES ('branding',?)`, v);
  }

  const aiCount = (await sql("SELECT COUNT(*) as count FROM system_settings WHERE key='aiKeys'")).rows[0].count;
  if (aiCount === 0) {
    await sql(`INSERT INTO system_settings (key,value) VALUES ('aiKeys','[]')`);
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@lms.com';
  const adminCount = (await sql('SELECT COUNT(*) as count FROM users WHERE email=?', adminEmail)).rows[0].count;
  if (adminCount === 0) {
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hashed = await bcrypt.hash(password, 10);
    await sql('INSERT INTO users (name,email,password,role_id) VALUES (?,?,?,1)', 'Admin', adminEmail, hashed);
    console.log(`Admin user created: ${adminEmail}`);
  }
}
