'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { useBranding } from './BrandingProvider';
import { useSidebar } from './SidebarContext';

const sections = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: 'dashboard' },
  { href: '/my-courses', label: 'كورساتي', icon: 'school' },
  { href: '/courses', label: 'الكورسات', icon: 'library_books' },
  { href: '/orders', label: 'طلباتي', icon: 'receipt_long' },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { systemName, logoHeader } = useBranding();
  const { collapsed, toggle } = useSidebar();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          style={{ backgroundColor: 'rgba(0,0,0,0.32)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile hamburger trigger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        <span className="material-symbols-outlined">menu</span>
      </button>

      <aside
        className={`fixed top-0 right-0 bottom-0 z-40 transform transition-all duration-300 flex flex-col lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
        style={{
          width: collapsed ? '72px' : '288px',
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          overflow: 'hidden',
        }}
      >
        {/* Branding */}
        <div className="px-5 pt-5 pb-3 shrink-0 flex items-center gap-3">
          <Link
            href="/dashboard"
            className={`overflow-hidden shrink-0 transition-transform duration-200 hover:scale-105 rounded-md3-sm ${
              collapsed ? 'flex items-center justify-center w-11 h-11' : ''
            }`}
            onClick={() => setMobileOpen(false)}
          >
            <img
              src={logoHeader || (collapsed ? '/branding/icon-192.png' : '/branding/logo.png')}
              alt={systemName}
              className={collapsed ? 'h-11 w-11 object-contain' : 'h-11'}
            />
          </Link>
          {!collapsed && (
            <span
              className="text-lg font-bold tracking-tight leading-tight truncate opacity-0 animate-[fadeIn_200ms_ease_forwards]"
              style={{ color: 'var(--md-sys-color-primary)' }}
            >
              {systemName}
            </span>
          )}
        </div>

        {/* User info — hidden when collapsed */}
        {!collapsed && (
          <div className="px-5 pb-3 shrink-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: 'var(--md-sys-color-on-surface)' }}
            >
              {user?.name}
            </p>
            <p
              className="text-xs mt-0.5 truncate"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              {user?.email}
            </p>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {sections.map((item) => {
            const active = isActive(item.href);
            return (
              <div key={item.href} className="relative">
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  onMouseEnter={() => setHoveredItem(item.href)}
                  onMouseLeave={() => setHoveredItem(null)}
                  className={`flex items-center gap-3 rounded-full text-sm font-medium transition-colors duration-200 ${
                    collapsed ? 'justify-center px-0 py-3 mx-1' : 'px-4 py-3'
                  }`}
                  style={{
                    backgroundColor: active ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                    color: active ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                  }}
                >
                  <span
                    className="material-symbols-outlined shrink-0"
                    style={{
                      fontSize: '22px',
                      fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
                    }}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>

                {/* MD3 Tooltip — only when collapsed */}
                {collapsed && hoveredItem === item.href && (
                  <div
                    className="fixed right-[80px] z-50 px-3 py-1.5 rounded-md3-sm text-xs font-medium whitespace-nowrap pointer-events-none"
                    style={{
                      backgroundColor: 'var(--md-sys-color-inverse-surface)',
                      color: 'var(--md-sys-color-inverse-on-surface)',
                      animation: 'fadeIn 150ms ease',
                    }}
                  >
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Collapse toggle — desktop only */}
        <div className="hidden lg:block px-3 py-3 shrink-0">
          <button
            onClick={toggle}
            className={`flex items-center gap-3 w-full rounded-full text-sm font-medium transition-colors duration-200 ${
              collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3'
            }`}
            style={{
              color: 'var(--md-sys-color-on-surface-variant)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container-highest)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <span
              className="material-symbols-outlined shrink-0"
              style={{
                fontSize: '22px',
                transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms cubic-bezier(0.2, 0, 0, 1)',
              }}
            >
              chevron_left
            </span>
            {!collapsed && <span>طي القائمة</span>}
          </button>
        </div>
      </aside>

      {/* fadeIn keyframe */}
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </>
  );
}
