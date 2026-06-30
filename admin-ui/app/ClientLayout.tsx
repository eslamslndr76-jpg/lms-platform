'use client';

import { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '../lib/auth';
import Sidebar from '../components/Sidebar';
import Chatbot from '../components/Chatbot';

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  useEffect(() => {
    if (!loading) {
      if (!user && !isLogin) {
        router.push('/login');
      } else if (user && isLogin) {
        router.push('/');
      }
    }
  }, [user, loading, isLogin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user && !isLogin) return null;
  if (user && isLogin) return null;

  if (isLogin) return <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>{children}</div>;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
        {children}
      </main>
      <Chatbot />
    </div>
  );
}