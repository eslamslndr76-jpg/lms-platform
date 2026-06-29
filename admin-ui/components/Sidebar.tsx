'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAdminAuth } from '../lib/auth';

const menuItems = [
  { href: '/', label: 'لوحة التحكم', icon: '📊' },
  { href: '/courses', label: 'الكورسات', icon: '📚' },
  { href: '/orders', label: 'الطلبات', icon: '📋' },
  { href: '/receipts', label: 'الإيصالات', icon: '🧾', adminOnly: true },
  { href: '/students', label: 'الطلاب', icon: '👥' },
  { href: '/groups', label: 'المجموعات', icon: '👥' },
  { href: '/financials', label: 'المالية', icon: '💰' },
  { href: '/reports', label: 'التقارير', icon: '📄' },
  { href: '/settings', label: 'الإعدادات', icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAdminAuth();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <>
      <button onClick={() => setOpen(!open)} className="lg:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-xl shadow-lg">
        <span className="text-2xl">{open ? '✕' : '☰'}</span>
      </button>

      <aside className={`fixed top-0 right-0 h-full w-64 bg-white shadow-xl z-40 transform transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen overflow-y-auto`}>
        <div className="p-4 border-b">
          <h1 className="font-bold text-lg" style={{ color: 'var(--primary,#2563eb)' }}>لوحة التحكم</h1>
          <p className="text-xs text-gray-500 mt-1">{user?.name} · {user?.role}</p>
        </div>

        <nav className="p-2 space-y-1">
          {menuItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            return (
              <Link key={item.href} href={item.href!} onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm ${isActive(item.href!) ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t mt-auto">
          <button onClick={logout} className="w-full py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl">
            تسجيل خروج
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
