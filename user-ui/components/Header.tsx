'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useBranding } from './BrandingProvider';
import { useDarkMode } from './DarkModeProvider';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import CartDrawer from './CartDrawer';
import NotificationBell from './NotificationBell';

const DASHBOARD_TITLES: Record<string, string> = {
  '/dashboard': 'لوحة التحكم',
  '/my-courses': 'كورساتي',
  '/courses': 'الكورسات',
  '/orders': 'طلباتي',
  '/cart': 'السلة',
  '/account': 'حسابي',
};

function getPageTitle(pathname: string): string {
  if (DASHBOARD_TITLES[pathname]) return DASHBOARD_TITLES[pathname];
  for (const [key, title] of Object.entries(DASHBOARD_TITLES)) {
    if (pathname?.startsWith(key)) return title;
  }
  return 'لوحة التحكم';
}

export default function Header() {
  const { systemName, logoHeader } = useBranding();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = user && /^\/(dashboard|my-courses|courses|orders|cart|account|attendance)/.test(pathname || '');
  const [cartDrawer, setCartDrawer] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const fetchCartCount = useCallback(async () => {
    if (!user) { setCartCount(0); return; }
    try {
      const data = await api('/api/cart');
      setCartCount(data.count || 0);
    } catch { setCartCount(0); }
  }, [user]);

  useEffect(() => { fetchCartCount(); }, [fetchCartCount]);
  useEffect(() => { const onFocus = () => fetchCartCount(); window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus); }, [fetchCartCount]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileMenu(false); }, [pathname]);

  const handleLogout = () => { logout(); router.push('/'); };
  const isActive = (path: string) => pathname === path;

  const pageTitle = isDashboard ? getPageTitle(pathname || '') : null;

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-40 h-16 flex items-center transition-all duration-300 ${isDashboard ? 'lg:mr-[var(--sidebar-width)]' : ''}`}
        style={{
          backgroundColor: scrolled ? 'var(--md-sys-color-surface-container)' : 'var(--md-sys-color-surface)',
          borderBottom: isDashboard ? 'none' : '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        <div
          className="px-4 sm:px-6 w-full flex items-center justify-between h-full"
          style={{
            maxWidth: isDashboard ? 'none' : undefined,
            margin: isDashboard ? undefined : '0 auto',
          }}
        >
          {/* Logo — only on public pages */}
          {!isDashboard && (
            <Link href="/" className="flex items-center gap-3 group shrink-0">
              {logoHeader ? (
                <div className="rounded-md3-sm overflow-hidden transition-transform duration-200 group-hover:scale-105">
                  <img src={logoHeader} alt={systemName} className="h-10" />
                </div>
              ) : (
                <span
                  className="text-lg font-bold tracking-tight"
                  style={{ color: 'var(--md-sys-color-primary)' }}
                >
                  {systemName}
                </span>
              )}
            </Link>
          )}

          {/* Dashboard: page title */}
          {isDashboard && (
            <h1
              className="text-lg font-semibold"
              style={{ color: 'var(--md-sys-color-on-surface)' }}
            >
              {pageTitle}
            </h1>
          )}

          {/* Nav + Actions */}
          <div className="flex items-center gap-1">
            {/* Public page nav links */}
            {!isDashboard && (
              <>
                <Link
                  href="/courses"
                  className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor: isActive('/courses') ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                    color: isActive('/courses') ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">school</span>
                  البرامج
                </Link>
                <Link
                  href="/download"
                  className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor: isActive('/download') ? 'var(--md-sys-color-primary-container)' : 'transparent',
                    color: isActive('/download') ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)',
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">smartphone</span>
                  التطبيق
                </Link>
                <Link
                  href="/verify"
                  className="hidden sm:inline-flex items-center gap-2 h-10 px-4 rounded-full text-sm font-medium transition-all duration-200"
                  style={{
                    backgroundColor: isActive('/verify') ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                    color: isActive('/verify') ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)',
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  تحقق من شهادة
                </Link>
              </>
            )}

            {/* Notifications — authenticated users only */}
            {user && <NotificationBell />}

            {/* Dark Mode Toggle — all pages */}
            <button
              onClick={toggleDark}
              className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200"
              style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
              title={dark ? 'الوضع الفاتح' : 'الوضع المظلم'}
            >
              <span className="material-symbols-outlined">
                {dark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {/* Cart — authenticated users only */}
            {user && (
              <button
                onClick={() => setCartDrawer(true)}
                className="relative w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200"
                style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
              >
                <span className="material-symbols-outlined">shopping_cart</span>
                {cartCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--md-sys-color-error)',
                      color: 'var(--md-sys-color-on-error)',
                    }}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Auth actions — all pages */}
            {user ? (
              <div className="flex items-center gap-1">
                <Link
                  href="/account"
                  className="h-10 px-5 rounded-full text-sm font-medium flex items-center justify-center transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                  }}
                >
                  حسابي
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200"
                  style={{ color: 'var(--md-sys-color-error)' }}
                  title="تسجيل خروج"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-error-container)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  <span className="material-symbols-outlined">logout</span>
                </button>
              </div>
            ) : (
              <Link
                href={isDashboard ? '?login=true' : '/login'}
                className="h-10 px-5 rounded-full text-sm font-medium flex items-center justify-center transition-all duration-200"
                style={{
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                }}
              >
                دخول
              </Link>
            )}

            {/* Mobile Menu Toggle — public pages only */}
            {!isDashboard && (
              <button
                onClick={() => setMobileMenu(!mobileMenu)}
                className="sm:hidden w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200"
                style={{ color: 'var(--md-sys-color-on-surface-variant)' }}
                aria-label="القائمة"
              >
                <span className="material-symbols-outlined">
                  {mobileMenu ? 'close' : 'menu'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu — public pages only */}
        {mobileMenu && !isDashboard && (
          <div
            className="sm:hidden absolute top-16 right-0 left-0 animate-fade-down"
            style={{
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div className="px-4 py-3 space-y-1">
              <Link
                href="/courses"
                className="flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-colors duration-200"
                style={{
                  backgroundColor: isActive('/courses') ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  color: isActive('/courses') ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)',
                }}
                onClick={() => setMobileMenu(false)}
              >
                <span className="material-symbols-outlined text-[20px]">school</span>
                البرامج
              </Link>
              <Link
                href="/download"
                className="flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-colors duration-200"
                style={{
                  backgroundColor: isActive('/download') ? 'var(--md-sys-color-primary-container)' : 'transparent',
                  color: isActive('/download') ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)',
                }}
                onClick={() => setMobileMenu(false)}
              >
                <span className="material-symbols-outlined text-[20px]">smartphone</span>
                تطبيق الموبايل
              </Link>
              <Link
                href="/verify"
                className="flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-colors duration-200"
                style={{
                  backgroundColor: isActive('/verify') ? 'var(--md-sys-color-secondary-container)' : 'transparent',
                  color: isActive('/verify') ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface)',
                }}
                onClick={() => setMobileMenu(false)}
              >
                <span className="material-symbols-outlined text-[20px]">verified</span>
                تحقق من شهادة
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Spacer for fixed header */}
      <div className="h-16" />

      <CartDrawer open={cartDrawer} onClose={() => { setCartDrawer(false); fetchCartCount(); }} />
    </>
  );
}
