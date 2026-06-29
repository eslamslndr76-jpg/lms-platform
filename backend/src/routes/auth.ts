import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { sql } from '../db/helpers';
import { generateToken, authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }
    const existing = await sql('SELECT id FROM users WHERE email=?', email);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const result = await sql(
      'INSERT INTO users (name, email, password, phone, role_id) VALUES (?,?,?,?,3)',
      name, email, hashed, phone || null,
    );
    const userId = Number(result.lastInsertRowid);
    const token = generateToken({ userId, roleId: 3, role: 'student' });
    res.status(201).json({ token, user: { id: userId, name, email, role: 'student' } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const result = await sql(
      `SELECT u.id, u.name, u.email, u.password, u.role_id, r.name as role_name
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.email=? AND u.is_active=1`,
      email,
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password as string);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken({
      userId: user.id as number,
      roleId: user.role_id as number,
      role: user.role_name as string,
    });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role_name },
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const result = await sql(
    `SELECT u.id, u.name, u.email, u.phone, u.role_id, r.name as role_name
     FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id=?`,
    req.user!.userId,
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

export default router;
