'use client';

import { ReactNode } from 'react';
import { AdminAuthProvider } from '../lib/auth';
import { DarkModeProvider } from '../components/DarkModeProvider';
import { BrandingProvider } from '../components/BrandingProvider';

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <DarkModeProvider>
      <AdminAuthProvider>
        <BrandingProvider>{children}</BrandingProvider>
      </AdminAuthProvider>
    </DarkModeProvider>
  );
}
