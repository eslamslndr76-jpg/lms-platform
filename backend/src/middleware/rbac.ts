import { Request, Response, NextFunction } from 'express';
import { sql } from '../db/helpers';

export const ADMIN = 1;
export const EMPLOYEE = 2;
export const STUDENT = 3;
/** Instructors are linked to groups and only see their own groups/forms. */
export const INSTRUCTOR = 4;

export type PermissionAction = 'read' | 'write';
export type PermissionMap = Record<string, string>;

export interface SectionDef {
  key: string;
  label: string;
  icon: string;
  description: string;
  /** Sections that only the system admin can reach, regardless of role permissions. */
  managerOnly?: boolean;
}

/**
 * The single source of truth for the permission matrix. Both the API and the
 * admin UI read from here so a new section only has to be added once.
 */
export const SECTIONS: SectionDef[] = [
  { key: 'dashboard', label: 'لوحة التحكم', icon: '📊', description: 'عرض المؤشرات والإحصائيات العامة' },
  { key: 'courses', label: 'الكورسات', icon: '📚', description: 'إنشاء وتعديل الكورسات والمحتوى التعليمي' },
  { key: 'categories', label: 'التصنيفات', icon: '🏷️', description: 'إدارة تصنيفات الكورسات' },
  { key: 'orders', label: 'الطلبات', icon: '📋', description: 'متابعة طلبات الشراء وتحديث حالتها' },
  { key: 'students', label: 'الطلاب', icon: '👥', description: 'عرض بيانات الطلاب وإدارتها' },
  { key: 'groups', label: 'المجموعات والمحاضرات', icon: '🗂️', description: 'المجموعات والمحاضرات والحضور' },
  { key: 'proposals', label: 'مقترحات الكورسات', icon: '📝', description: 'مراجعة مقترحات المحاضرين وإنشاء الكورسات منها' },
  { key: 'places', label: 'الأماكن', icon: '📍', description: 'قاعات التدريب وسعاتها وربطها بالمجموعات' },
  { key: 'certificates', label: 'الشهادات', icon: '🎓', description: 'إصدار الشهادات وإلغاؤها' },
  { key: 'financials', label: 'المالية', icon: '💰', description: 'عرض الملخص المالي والمدفوعات' },
  { key: 'employees', label: 'الحسابات والصلاحيات', icon: '🔐', description: 'إدارة الموظفين والأدوار والصلاحيات', managerOnly: true },
  { key: 'settings', label: 'الإعدادات', icon: '⚙️', description: 'إعدادات المنصة والإشعارات والهوية', managerOnly: true },
];

export const PERMISSION_ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: 'read', label: 'عرض' },
  { key: 'write', label: 'تعديل' },
];

/** Parse a permissions value coming from the DB (TEXT) or from a request body. */
export function parsePermissions(value: unknown): PermissionMap {
  if (!value) return {};
  if (typeof value === 'object') return value as PermissionMap;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? (parsed as PermissionMap) : {};
  } catch {
    return {};
  }
}

/**
 * Keep only known sections/actions. An empty string means "no access" and is
 * preserved so a per-user override can revoke a permission granted by the role.
 * Manager-only sections (accounts/settings) are never granted through a role.
 */
export function normalizePermissions(value: unknown): PermissionMap {
  const raw = parsePermissions(value);
  const result: PermissionMap = {};
  for (const [section, actions] of Object.entries(raw)) {
    const definition = SECTIONS.find((item) => item.key === section);
    if (!definition || definition.managerOnly) continue;
    const list = String(actions || '')
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a === 'read' || a === 'write');
    if (list.includes('write') && !list.includes('read')) list.unshift('read');
    result[section] = Array.from(new Set(list)).join(',');
  }
  return result;
}

/**
 * Effective permissions = role permissions, overridden per section by the
 * user's personal permissions (a section present in the user map wins, even
 * when it is empty).
 */
export function mergePermissions(rolePermissions: unknown, userPermissions: unknown): PermissionMap {
  const rolePerms = parsePermissions(rolePermissions);
  if (rolePerms.all) return { all: 'true' };
  const merged: PermissionMap = { ...normalizePermissions(rolePerms) };
  const overrides = normalizePermissions(userPermissions);
  for (const [section, actions] of Object.entries(overrides)) {
    merged[section] = actions;
  }
  return merged;
}

export function hasPermission(
  permissions: PermissionMap,
  section: string,
  action: PermissionAction,
): boolean {
  if (permissions.all) return true;
  const actions = String(permissions[section] || '')
    .split(',')
    .map((a) => a.trim());
  return actions.includes(action);
}

/** Load the effective permission map for a user from the database. */
export async function getEffectivePermissions(
  userId: number,
  roleId: number,
): Promise<PermissionMap> {
  const roleResult = await sql('SELECT permissions FROM roles WHERE id=?', roleId);
  const rolePermissions = roleResult.rows[0]?.permissions;
  const userResult = await sql('SELECT permissions FROM users WHERE id=?', userId);
  const userOverrides = userResult.rows[0]?.permissions;
  return mergePermissions(rolePermissions, userOverrides);
}

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

/**
 * Server-side permission gate. Admins always pass; everyone else must hold the
 * requested action on the section, either through their role or a personal
 * override. Pairs with `requireRole(ADMIN, EMPLOYEE)`.
 */
export function requirePermission(section: string, action: PermissionAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (Number(req.user.roleId) === ADMIN) return next();
    try {
      const permissions = await getEffectivePermissions(
        Number(req.user.userId),
        Number(req.user.roleId),
      );
      if (hasPermission(permissions, section, action)) return next();
      return res.status(403).json({ error: `No ${action} permission for ${section}` });
    } catch {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/** Passes when the user holds `action` on at least one of the given sections. */
export function requireAnyPermission(sections: string[], action: PermissionAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (Number(req.user.roleId) === ADMIN) return next();
    try {
      const permissions = await getEffectivePermissions(
        Number(req.user.userId),
        Number(req.user.roleId),
      );
      if (sections.some((section) => hasPermission(permissions, section, action))) return next();
      return res.status(403).json({ error: 'Forbidden' });
    } catch {
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}
