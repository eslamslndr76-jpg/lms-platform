import { Request, Response, NextFunction } from 'express';
import { sql } from '../db/helpers';

export function requireRole(...roleIds: number[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!roleIds.includes(Number(req.user.roleId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

export function requirePermission(section: string, action: 'read' | 'write') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.user.roleId === ADMIN) {
      return next();
    }
    try {
      const result = await sql('SELECT permissions FROM roles WHERE id=?', req.user.roleId);
      if (result.rows.length === 0) return res.status(403).json({ error: 'Forbidden' });
      const perms = JSON.parse(result.rows[0].permissions as string || '{}');
      if (perms.all) return next();
      const sectionPerms = (perms[section] || '') as string;
      if (sectionPerms.includes(action)) return next();
      return res.status(403).json({ error: `No ${action} permission for ${section}` });
    } catch {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

export const ADMIN = 1;
export const EMPLOYEE = 2;
export const STUDENT = 3;

export const SECTIONS = {
  courses: 'الكورسات',
  orders: 'الطلبات',
  students: 'الطلاب',
  groups: 'المجموعات',
  financials: 'المالية',
  settings: 'الإعدادات',
  categories: 'التصنيفات',
  employees: 'الموظفين',
} as const;
