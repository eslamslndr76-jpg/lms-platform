'use client';

import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'next/navigation';
import DashboardSidebar from '../../components/DashboardSidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex" style={{ minHeight: 'calc(100vh - 73px)' }}>
      <DashboardSidebar />
      <main className="flex-1 min-w-0 p-4 lg:p-6 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
