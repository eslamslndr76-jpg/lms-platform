'use client';

import { ReactNode } from 'react';
import { AdminAuthProvider } from '../lib/auth';

export function AdminProviders({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
