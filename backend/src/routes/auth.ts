import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { sql } from '../db/helpers';
import { generateToken, authMiddleware } from '../middleware/auth';
import { sendNotification } from '../services/externalNotificationService';
import { normalizePhone } from '../db/helpers';
import { mergePermissions, parsePermissions } from '../middleware/rbac';

const router = Router();

router.post('/check-phone', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    const cleanedPhone = phone.replace(/\s/g, '');
    if (!/^01[0-9]{9}$/.test(cleanedPhone)) {
      return res.status(400).json({ error: 'رقم الهاتف غير صحيح' });
    }
    const existing = await sql('SELECT id FROM users WHERE phone=?', cleanedPhone);
    res.json({ exists: existing.rows.length > 0 });
  } catch {
    res.status(500).json({ error: 'Failed to check phone' });
  }
});

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, nationalId, birthDate, gender, governorate, isEnrolled, universityName, universityCode } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'رقم الهاتف مطلوب' });
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ error: 'رقم الهاتف يجب أن يكون 11 رقم ويبدأ بـ 01' });
    }
    if (!nationalId) {
      return res.status(400).json({ error: 'الرقم القومى مطلوب' });
    }
    if (!/^\d{14}$/.test(nationalId.replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'الرقم القومى يجب أن يكون 14 رقماً' });
    }
    if (isEnrolled) {
      if (!universityName || !universityName.trim()) {
        return res.status(400).json({ error: 'اسم المعهد او الجامعه مطلوب' });
      }
      if (!universityCode || !universityCode.trim()) {
        return res.status(400).json({ error: 'الكود الجامعى مطلوب' });
      }
    }
    const existing = await sql('SELECT id FROM users WHERE email=?', email);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
    }
    const phoneCheck = await sql('SELECT id FROM users WHERE phone=?', normalizedPhone);
    if (phoneCheck.rows.length > 0) {
      return res.status(409).json({ error: 'الرقم مسجل من قبل، جرب تسجيل الدخول' });
    }
    if (nationalId) {
      const idCheck = await sql('SELECT id FROM users WHERE national_id=?', nationalId);
      if (idCheck.rows.length > 0) {
        return res.status(409).json({ error: 'الرقم القومى مستخدم بالفعل' });
      }
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await sql(
      `INSERT INTO users (name, email, password, phone, role_id, national_id, birth_date, gender, governorate, is_enrolled, university_name, university_code, email_notifications, telegram_notifications)
       VALUES (?,?,?,?,3,?,?,?,?,?,?,?,1,1)`,
       name, email, hashed, normalizedPhone,
      nationalId || null, birthDate || null, gender || null, governorate || null,
      isEnrolled ? 1 : 0, universityName || null, universityCode || null,
    );
    const userId = Number(result.lastInsertRowid);
    const token = generateToken({ userId, roleId: 3, role: 'student' });

    // External notification (email + telegram)
    await sendNotification(userId, 'account_created', { name }).catch(e => console.error('[Notify] account_created failed:', e.message));

    res.status(201).json({ token, user: { id: userId, name, email, role: 'student' } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email/phone and password required' });
    }
    const result = await sql(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.password, u.role_id, r.name as role_name,
              r.permissions as role_permissions, u.permissions as user_permissions
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE (u.email=? OR u.phone=?) AND u.is_active=1`,
      email, email,
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password as string);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    await sql('UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?', user.id).catch(() => undefined);
    const token = generateToken({
      userId: user.id as number,
      roleId: user.role_id as number,
      role: user.role_name as string,
    });
    const permissions = mergePermissions(user.role_permissions, user.user_permissions);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role_name,
        role_id: Number(user.role_id),
        permissions,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error?.message, error?.stack);
    res.status(500).json({ error: error?.message || 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await sql(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar, u.role_id, r.name as role_name,
              r.permissions as role_permissions, u.permissions as user_permissions, u.last_login,
              u.birth_date, u.gender, u.governorate, u.university_name, u.university_code
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id=?`,
      req.user!.userId,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const row: any = result.rows[0];
    res.json({
      ...row,
      role_id: Number(row.role_id),
      role_permissions: parsePermissions(row.role_permissions),
      user_permissions: parsePermissions(row.user_permissions),
      permissions: mergePermissions(row.role_permissions, row.user_permissions),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

router.put('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    const user = await sql('SELECT password FROM users WHERE id=?', req.user!.userId);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.rows[0].password as string);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await sql('UPDATE users SET password=? WHERE id=?', hashed, req.user!.userId);
    res.json({ message: 'Password updated' });
  } catch {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { name, phone, avatar, birthDate, gender, governorate, universityName, universityCode } = req.body;
    const normalizedPhone = phone !== undefined ? normalizePhone(phone) : null;
    await sql(
      `UPDATE users SET
        name=COALESCE(?,name),
        phone=COALESCE(?,phone),
        avatar=COALESCE(?,avatar),
        birth_date=COALESCE(?,birth_date),
        gender=COALESCE(?,gender),
        governorate=COALESCE(?,governorate),
        university_name=COALESCE(?,university_name),
        university_code=COALESCE(?,university_code)
       WHERE id=?`,
      name || null, normalizedPhone, avatar || null,
      birthDate || null, gender || null, governorate || null,
      universityName || null, universityCode || null,
      req.user!.userId,
    );
    const updated = await sql(
      `SELECT id, name, email, phone, avatar, role_id,
              birth_date, gender, governorate, university_name, university_code
       FROM users WHERE id=?`,
      req.user!.userId,
    );
    res.json(updated.rows[0]);
  } catch {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
