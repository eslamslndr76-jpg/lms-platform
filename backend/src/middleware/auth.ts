import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

let JWT_SECRET: string;

function getJwtSecret(): string {
  if (JWT_SECRET) return JWT_SECRET;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET environment variable is required');
    JWT_SECRET = 'fallback-dev-secret-do-not-use-in-production';
    return JWT_SECRET;
  }
  JWT_SECRET = secret;
  return JWT_SECRET;
}

export interface AuthPayload {
  userId: number;
  roleId: number;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign({
    userId: Number(payload.userId),
    roleId: Number(payload.roleId),
    role: payload.role,
  }, getJwtSecret(), { expiresIn: '7d' });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, getJwtSecret()) as unknown as AuthPayload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.split(' ')[1];
      req.user = jwt.verify(token, getJwtSecret()) as unknown as AuthPayload;
    } catch {
      // ignore invalid token
    }
  }
  next();
}
