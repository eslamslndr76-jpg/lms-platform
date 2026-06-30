'use client';

import { ReactNode } from 'react';
import { AdminAuthProvider } from '../lib/auth';
import { DarkModeProvider } from '../components/DarkModeProvider';
import { BrandingProvider } from '../components/BrandingProvider';
import { ToastProvider } from '../components/Toast';

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <DarkModeProvider>
      <AdminAuthProvider>
        <BrandingProvider>
          <ToastProvider>{children}</ToastProvider>
        </BrandingProvider>
      </AdminAuthProvider>
    </DarkModeProvider>
  );
}
