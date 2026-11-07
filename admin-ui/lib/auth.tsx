'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { api } from './api';

export type PermissionAction = 'read' | 'write';
export type PermissionMap = Record<string, string>;

export const ADMIN_ROLE_ID = 1;

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  role_id: number;
  phone?: string;
  avatar?: string;
  /** Effective map merged from the role and the user's own overrides. */
  permissions?: PermissionMap;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  permissions: PermissionMap;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** True when the signed-in user holds `action` on `section`. */
  can: (section: string, action?: PermissionAction) => boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  permissions: {},
  isAdmin: false,
  login: async () => {},
  logout: () => {},
  can: () => false,
  loading: true,
});

function buildPermissions(data: any): PermissionMap {
  const source = data?.permissions ?? data?.user_permissions ?? {};
  return source && typeof source === 'object' ? (source as PermissionMap) : {};
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) {
      setToken(saved);
      api('/api/auth/me')
        .then((data: any) => {
          if (data.role_name === 'admin' || data.role_name === 'employee') {
            setUser({
              ...data,
              role: data.role_name,
              role_id: Number(data.role_id),
              permissions: buildPermissions(data),
            });
          } else {
            localStorage.removeItem('admin_token');
          }
        })
        .catch(() => localStorage.removeItem('admin_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data: any = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.user.role !== 'admin' && data.user.role !== 'employee') {
      throw new Error('Unauthorized: Admin access only');
    }
    localStorage.setItem('admin_token', data.token);
    setToken(data.token);
    setUser({ ...data.user, role_id: Number(data.user.role_id), permissions: buildPermissions(data.user) });
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  };

  const permissions = useMemo(() => user?.permissions ?? {}, [user]);
  const isAdmin = useMemo(() => Number(user?.role_id) === ADMIN_ROLE_ID, [user]);

  const can = useCallback(
    (section: string, action: PermissionAction = 'read') => {
      if (!user) return false;
      if (isAdmin || permissions.all) return true;
      const actions = String(permissions[section] || '')
        .split(',')
        .map((a) => a.trim());
      return actions.includes(action);
    },
    [user, isAdmin, permissions],
  );

  return (
    <AuthContext.Provider value={{ user, token, permissions, isAdmin, login, logout, can, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAdminAuth = () => useContext(AuthContext);
