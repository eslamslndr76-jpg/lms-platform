'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAdminAuth } from '../lib/auth';
import { useDarkMode } from './DarkModeProvider';
import { useBranding } from './BrandingProvider';

const allSections = [
  { href: '/', label: 'لوحة التحكم', section: 'dashboard', icon: '📊' },
  { href: '/courses', label: 'الكورسات', section: 'courses', icon: '📚' },
  { href: '/orders', label: 'الطلبات', section: 'orders', icon: '📋' },
  { href: '/students', label: 'الطلاب', section: 'students', icon: '👥' },
  { href: '/certificates', label: 'الشهادات', section: 'certificates', icon: '🎓' },
  { href: '/financials', label: 'المالية', section: 'financials', icon: '💰' },
  { href: '/employees', label: 'الموظفين', section: 'employees', icon: '🔐' },
  { href: '/settings', label: 'الإعدادات', section: 'settings', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { systemName, logoHeader } = useBranding();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));

  const canView = (section: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (section === 'dashboard') return true;
    if (section === 'students' || section === 'employees' || section === 'settings') return false;
    return true;
  };

  return (
    <>
      <aside className={`fixed top-0 right-0 h-full w-64 z-40 shadow-xl transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen overflow-y-auto`} style={{ backgroundColor: 'var(--sidebar-bg)' }}>
        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 min-w-0">
            {logoHeader ? (
              <img src={logoHeader} alt={systemName} className="h-8 shrink-0" />
            ) : (
              <h1 className="font-bold text-lg truncate" style={{ color: 'var(--primary)' }}>{systemName}</h1>
            )}
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1.5 rounded-xl text-lg hover:bg-[var(--bg)]" style={{ color: 'var(--text)' }}>
            ✕
          </button>
        </div>
        <div className="px-4 pb-2 -mt-1">
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.name} · {user?.role}</p>
        </div>

        <nav className="p-2 space-y-1">
          {allSections.map((item) => {
            if (!canView(item.section)) return null;
            return (
              <Link key={item.href} href={item.href!} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${isActive(item.href!) ? 'font-medium shadow-sm' : 'hover:bg-[var(--bg)]'}`}
                style={isActive(item.href!) ? { backgroundColor: 'var(--primary)', color: '#fff' } : { color: 'var(--text)' }}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2" style={{ borderColor: 'var(--border)' }}>
          <Link href="/account" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all hover:bg-[var(--bg)]" style={{ color: 'var(--text)' }}>
            <span>👤</span><span>حسابي</span>
          </Link>
          <button onClick={toggleDark} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-sm transition-all hover:bg-[var(--bg)]" style={{ color: 'var(--text)' }}>
            <span>{dark ? '☀️' : '🌙'}</span><span>{dark ? 'وضع فاتح' : 'وضع مظلم'}</span>
          </button>
          <button onClick={logout} className="w-full py-2 text-sm rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20" style={{ color: '#ef4444' }}>
            تسجيل خروج
          </button>
        </div>
      </aside>

      {!open && (
        <button onClick={() => setOpen(true)} className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white text-xl" style={{ backgroundColor: 'var(--primary)' }}>
          ☰
        </button>
      )}
      {open && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
