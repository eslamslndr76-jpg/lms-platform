'use client';

import { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAdminAuth } from '../lib/auth';
import Sidebar from '../components/Sidebar';
import AIAssistant from '../components/AIAssistant';

/** Top-level route → permission section required to open it. */
const SECTION_BY_PATH: Record<string, string> = {
  courses: 'courses',
  proposals: 'proposals',
  orders: 'orders',
  students: 'students',
  certificates: 'certificates',
  financials: 'financials',
  permissions: 'employees',
  employees: 'employees',
  settings: 'settings',
};

export default function ClientLayout({ children }: { children: ReactNode }) {
  const { user, loading, can } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/login';

  const segment = pathname?.split('/')[1] || '';
  const requiredSection = SECTION_BY_PATH[segment];
  const canOpen = !requiredSection || can(requiredSection);

  useEffect(() => {
    if (!loading) {
      if (!user && !isLogin) {
        router.push('/login');
      } else if (user && isLogin) {
        router.push('/');
      } else if (user && !canOpen && pathname !== '/') {
        router.push('/');
      }
    }
  }, [user, loading, isLogin, router, canOpen, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user && !isLogin) return null;
  if (user && isLogin) return null;
  if (user && !canOpen && pathname !== '/') return null;

  if (isLogin) return <div style={{ backgroundColor: 'var(--bg)', minHeight: '100vh' }}>{children}</div>;

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
        {children}
      </main>
      <AIAssistant />
    </div>
  );
}
