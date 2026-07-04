'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  avatar?: string;
  nationalId?: string;
  birthDate?: string;
  gender?: string;
  governorate?: string;
  isEnrolled?: number;
  universityName?: string;
  universityCode?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, phone?: string, nationalId?: string, birthDate?: string, gender?: string, governorate?: string, isEnrolled?: boolean, universityName?: string, universityCode?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('token');
    if (saved) {
      setToken(saved);
      api('/api/auth/me').then(data => {
        setUser({ ...data, role: data.role_name });
      }).catch(() => localStorage.removeItem('token')).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string, phone?: string, nationalId?: string, birthDate?: string, gender?: string, governorate?: string, isEnrolled?: boolean, universityName?: string, universityCode?: string) => {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone, nationalId, birthDate, gender, governorate, isEnrolled, universityName, universityCode }),
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
