'use client';

import { ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { BrandingProvider } from '../components/BrandingProvider';
import { AuthProvider } from '../lib/auth';
import { ToastProvider } from '../components/Toast';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <BrandingProvider>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </BrandingProvider>
    </ErrorBoundary>
  );
}
