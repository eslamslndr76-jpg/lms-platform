import { Request, Response, NextFunction } from 'express';

export function requireRole(...roleIds: number[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roleIds.includes(req.user.roleId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export const ADMIN = 1;
export const EMPLOYEE = 2;
export const STUDENT = 3;
