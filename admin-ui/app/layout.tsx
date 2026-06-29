'use client';

import { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '../lib/auth';
import Sidebar from '../components/Sidebar';
import Chatbot from '../components/Chatbot';
import { AdminProviders } from './providers';
import './globals.css';

function AdminLayoutInner({ children }: { children: ReactNode }) {
  const { user, loading } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user && !isLogin) {
    router.push('/login');
    return null;
  }

  if (user && isLogin) {
    router.push('/');
    return null;
  }

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
        {children}
      </main>
      <Chatbot />
    </div>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <AdminProviders>
          <AdminLayoutInner>{children}</AdminLayoutInner>
        </AdminProviders>
      </body>
    </html>
  );
}
