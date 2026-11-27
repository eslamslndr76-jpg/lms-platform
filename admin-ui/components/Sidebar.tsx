'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '../lib/auth';
import { useBranding } from './BrandingProvider';

const allSections = [
  { href: '/', label: 'لوحة التحكم', section: 'dashboard', icon: 'dashboard' },
  { href: '/courses', label: 'الكورسات', section: 'courses', icon: 'menu_book' },
  { href: '/proposals', label: 'مقترحات الكورسات', section: 'proposals', icon: 'description' },
  { href: '/orders', label: 'الطلبات', section: 'orders', icon: 'receipt_long' },
  { href: '/students', label: 'الطلاب', section: 'students', icon: 'groups' },
  { href: '/certificates', label: 'الشهادات', section: 'certificates', icon: 'workspace_premium' },
  { href: '/financials', label: 'المالية', section: 'financials', icon: 'payments' },
  { href: '/permissions', label: 'المستخدمون والصلاحيات', section: 'employees', icon: 'admin_panel_settings' },
  { href: '/settings', label: 'الإعدادات', section: 'settings', icon: 'settings' },
];

interface SidebarProps {
  /** Mobile drawer open state (owned by ClientLayout). */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Desktop icon-rail collapse (owned by ClientLayout). */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ open, onOpenChange, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, can } = useAdminAuth();
  const { systemName, logoHeader } = useBranding();

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));
  const roleLabel = user?.role === 'admin' ? 'مدير النظام' : user?.role === 'employee' ? 'موظف' : user?.role;

  const navItem = (item: (typeof allSections)[number], rail: boolean) => {
    if (!can(item.section)) return null;
    const active = isActive(item.href!);
    return (
      <Link
        key={item.href}
        href={item.href!}
        onClick={() => onOpenChange(false)}
        title={rail ? item.label : undefined}
        aria-label={rail ? item.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-3 text-sm transition-colors md3-state-layer ${
          rail ? 'justify-center h-12 w-12 mx-auto rounded-full' : 'rounded-full px-4 h-12'
        }`}
        style={
          active
            ? {
                backgroundColor: 'var(--md-sys-color-secondary-container)',
                color: 'var(--md-sys-color-on-secondary-container)',
                fontWeight: 700,
                width: rail ? 56 : undefined,
              }
            : { color: 'var(--md-sys-color-on-surface-variant)', width: rail ? 56 : undefined }
        }
      >
        <span className="material-symbols-outlined text-[22px] shrink-0" aria-hidden>
          {item.icon}
        </span>
        {!rail && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  return (
    <>
      <aside
        className={`fixed top-0 right-0 h-screen z-40 md3-elevation-1 transform transition-all duration-300 overflow-x-hidden ${
          open ? 'translate-x-0' : 'translate-x-full'
        } lg:translate-x-0 overflow-y-auto`}
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-low)',
          width: collapsed ? 76 : 280,
        }}
        aria-label="التنقل الرئيسي"
      >
        {/* Header: logo + collapse toggle */}
        <div className={`px-3 pt-4 pb-3 flex gap-2 ${collapsed ? 'flex-col items-center' : 'flex-row items-center justify-between'}`}>
          <Link href="/" className="flex items-center gap-2 min-w-0 overflow-hidden" onClick={() => onOpenChange(false)}>
            <img
              src={logoHeader || '/branding/logo.png'}
              alt={systemName}
              className={collapsed ? 'h-9 w-auto max-w-[60px] object-contain mx-auto' : 'h-11'}
            />
          </Link>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
            className="md3-btn md3-btn--icon shrink-0 hidden lg:inline-flex"
          >
            <span className="material-symbols-outlined text-[20px]">
              {collapsed ? 'chevron_left' : 'chevron_right'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="إغلاق القائمة"
            className="md3-btn md3-btn--icon shrink-0 lg:hidden"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Signed-in user */}
        {!collapsed && (
          <div className="px-4 pb-2">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
              {user?.name}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {roleLabel}
            </p>
          </div>
        )}

        {/* Navigation */}
        {/* rail=true only on desktop when collapsed; mobile drawer always shows labels */}
        <nav className={`py-2 space-y-1 ${collapsed ? 'px-2' : 'px-3'}`} aria-label="أقسام اللوحة">
          {allSections.map((item) => navItem(item, collapsed && !open))}
        </nav>

        {/* Footer: account + logout (dark mode & notifications live in the top app bar) */}
        <div
          className={`py-4 mt-2 border-t space-y-1 ${collapsed && !open ? 'px-2' : 'px-3'}`}
          style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}
        >
          <Link
            href="/account"
            onClick={() => onOpenChange(false)}
            title={collapsed && !open ? 'حسابي' : undefined}
            aria-label={collapsed && !open ? 'حسابي' : undefined}
            className={`flex items-center gap-3 text-sm transition-colors md3-state-layer ${
              collapsed && !open ? 'justify-center h-12 w-12 mx-auto rounded-full' : 'rounded-full px-4 h-12'
            }`}
            style={{ color: 'var(--md-sys-color-on-surface-variant)', width: collapsed && !open ? 56 : undefined }}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden>person</span>
            {(!collapsed || open) && <span>حسابي</span>}
          </Link>
          <button
            onClick={logout}
            title={collapsed && !open ? 'تسجيل خروج' : undefined}
            aria-label={collapsed && !open ? 'تسجيل خروج' : undefined}
            className={`flex items-center gap-3 text-sm w-full transition-colors md3-state-layer ${
              collapsed && !open ? 'justify-center h-12 w-12 mx-auto rounded-full' : 'rounded-full px-4 h-12'
            }`}
            style={{ color: 'var(--md-sys-color-error)', width: collapsed && !open ? 56 : undefined }}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden>logout</span>
            {(!collapsed || open) && <span>تسجيل خروج</span>}
          </button>
        </div>
      </aside>

      {/* Mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-[35] lg:hidden"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
