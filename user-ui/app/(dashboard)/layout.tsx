'use client';

import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useRouter } from 'next/navigation';
import DashboardSidebar from '../../components/DashboardSidebar';
import { SidebarProvider } from '../../components/SidebarContext';
import { loginUrl } from '../../lib/redirect';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push(loginUrl());
      return;
    }
    if (user.role === 'instructor') router.push('/instructor');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user || user.role === 'instructor') return null;

  return (
    <SidebarProvider>
      <div className="flex">
        <DashboardSidebar />
        <main className="flex-1 min-w-0 p-4 lg:p-6 pb-24 lg:pb-6 overflow-x-hidden lg:mr-[var(--sidebar-width)] transition-[margin] duration-300">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
