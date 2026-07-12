'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useBranding } from './BrandingProvider';
import { useDarkMode } from './DarkModeProvider';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import CartDrawer from './CartDrawer';

export default function Header({ hideNav = false }: { hideNav?: boolean }) {
  const { systemName, primaryColor, secondaryColor, logoHeader } = useBranding();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [cartDrawer, setCartDrawer] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cartBounce, setCartBounce] = useState(false);
  const prevCount = useRef(0);

  const fetchCartCount = useCallback(async () => {
    if (!user) { setCartCount(0); return; }
    try {
      const data = await api('/api/cart');
      const newCount = data.count || 0;
      if (newCount > prevCount.current && prevCount.current > 0) {
        setCartBounce(true);
        setTimeout(() => setCartBounce(false), 500);
      }
      prevCount.current = newCount;
      setCartCount(newCount);
    } catch { setCartCount(0); }
  }, [user]);

  useEffect(() => { fetchCartCount(); }, [fetchCartCount]);
  useEffect(() => { const onFocus = () => fetchCartCount(); window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus); }, [fetchCartCount]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMobileMenu(false);
  }, [pathname]);

  const handleLogout = () => { logout(); router.push('/'); };

  const isActive = (path: string) => pathname === path;

  return (
    <>
      <header
        className={`fixed top-0 right-0 left-0 z-40 transition-all duration-500 ${
          scrolled
            ? 'shadow-lg backdrop-blur-xl border-b'
            : 'bg-transparent border-b border-transparent'
        }`}
        style={{
          backgroundColor: scrolled ? 'var(--glass-bg)' : 'transparent',
          borderColor: scrolled ? 'var(--border)' : 'transparent',
        }}
      >
        {/* Animated gradient line */}
        <div
          className={`absolute bottom-0 left-0 right-0 h-[1.5px] transition-opacity duration-700 ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            background: `linear-gradient(90deg, transparent, ${primaryColor}, ${secondaryColor}, transparent)`,
            backgroundSize: '200% 100%',
            animation: 'gradient-shift 3s ease infinite',
          }}
        />

        <div className="px-4 sm:px-6 py-3 flex items-center justify-between max-w-7xl mx-auto relative">
          {/* Logo */}
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3 group relative">
            {logoHeader ? (
              <div className="rounded-xl p-0.5 shadow-sm border transition-all duration-300 group-hover:scale-105" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                <img src={logoHeader} alt={systemName} className="h-10 sm:h-12" />
              </div>
            ) : (
              <h1
                className="text-lg sm:text-xl font-black tracking-tight bg-clip-text text-transparent transition-all duration-300"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
                }}
              >
                {systemName}
              </h1>
            )}
            {/* Glow dot */}
            <span
              className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full animate-pulse-soft"
              style={{ backgroundColor: primaryColor }}
            />
          </Link>

          {/* Nav + Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {!hideNav && (
              <>
                <Link
                  href="/courses"
                  className={`hidden sm:inline-flex relative items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-medium transition-all duration-300 overflow-hidden group/nav ${
                    isActive('/courses')
                      ? 'text-white shadow-md'
                      : 'hover:scale-105 active:scale-95'
                  }`}
                  style={{
                    backgroundColor: isActive('/courses') ? primaryColor : 'transparent',
                    color: isActive('/courses') ? '#fff' : 'var(--text-muted)',
                    boxShadow: isActive('/courses') ? `0 4px 15px ${primaryColor}40` : 'none',
                  }}
                >
                  {/* Hover bg fill */}
                  <span
                    className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                      isActive('/courses')
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/nav:opacity-100'
                    }`}
                    style={{
                      background: isActive('/courses')
                        ? primaryColor
                        : `${primaryColor}10`,
                    }}
                  />
                  {/* Icon */}
                  <span className="relative z-10 text-base transition-transform duration-300 group-hover/nav:scale-110 group-hover/nav:-translate-y-0.5">
                    📚
                  </span>
                  {/* Label */}
                  <span className="relative z-10 font-medium">البرامج</span>
                  {/* Active glow dot */}
                  {isActive('/courses') && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse-soft"
                      style={{ backgroundColor: '#fff' }}
                    />
                  )}
                  {/* Shimmer on hover */}
                  <span
                    className={`absolute inset-0 -translate-x-full ${
                      isActive('/courses')
                        ? ''
                        : 'group-hover/nav:translate-x-full'
                    } transition-transform duration-700`}
                    style={{
                      background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)`,
                    }}
                  />
                </Link>
                <Link
                  href="/verify"
                  className={`hidden sm:inline-flex relative items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-medium transition-all duration-300 overflow-hidden group/nav ${
                    isActive('/verify')
                      ? 'text-white shadow-md'
                      : 'hover:scale-105 active:scale-95'
                  }`}
                  style={{
                    backgroundColor: isActive('/verify') ? primaryColor : 'transparent',
                    color: isActive('/verify') ? '#fff' : 'var(--text-muted)',
                    boxShadow: isActive('/verify') ? `0 4px 15px ${primaryColor}40` : 'none',
                  }}
                >
                  {/* Hover bg fill */}
                  <span
                    className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                      isActive('/verify')
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/nav:opacity-100'
                    }`}
                    style={{
                      background: isActive('/verify')
                        ? primaryColor
                        : `${primaryColor}10`,
                    }}
                  />
                  {/* Icon */}
                  <span className="relative z-10 text-base transition-transform duration-300 group-hover/nav:scale-110 group-hover/nav:-translate-y-0.5">
                    🎓
                  </span>
                  {/* Label */}
                  <span className="relative z-10 font-medium">تحقق من شهادة</span>
                  {/* Active glow dot */}
                  {isActive('/verify') && (
                    <span
                      className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse-soft"
                      style={{ backgroundColor: '#fff' }}
                    />
                  )}
                  {/* Shimmer on hover */}
                  <span
                    className={`absolute inset-0 -translate-x-full ${
                      isActive('/verify')
                        ? ''
                        : 'group-hover/nav:translate-x-full'
                    } transition-transform duration-700`}
                    style={{
                      background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)`,
                    }}
                  />
                </Link>
              </>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDark}
              className="relative p-2.5 rounded-xl border transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-95 overflow-hidden group/dark"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              title={dark ? 'الوضع الفاتح' : 'الوضع المظلم'}
            >
              <span className="relative z-10 transition-transform duration-500 inline-block" style={{ transform: dark ? 'rotate(360deg)' : 'rotate(0deg)' }}>
                {dark ? '☀️' : '🌙'}
              </span>
              {/* Ripple on hover */}
              <span
                className="absolute inset-0 rounded-xl opacity-0 group-hover/dark:opacity-100 transition-opacity duration-300"
                style={{ backgroundColor: `${primaryColor}08` }}
              />
            </button>

            {/* Cart */}
            {user && (
              <button
                onClick={() => setCartDrawer(true)}
                className={`relative p-2.5 rounded-xl border transition-all duration-300 hover:scale-105 hover:shadow-md active:scale-95 ${cartBounce ? 'animate-pulse-soft' : ''}`}
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <svg className="w-5 h-5 transition-transform duration-300 hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
                {cartCount > 0 && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-white text-[10px] flex items-center justify-center font-extrabold shadow-lg transition-all duration-300 ${
                      cartBounce ? 'scale-125' : 'scale-100'
                    }`}
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            )}

            {/* User Menu */}
            {user ? (
              <div className="flex items-center gap-1">
                <Link
                  href="/account"
                  className="relative text-sm font-bold px-4 py-2.5 rounded-xl text-white transition-all duration-300 hover:opacity-90 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 overflow-hidden group/btn"
                  style={{ backgroundColor: primaryColor }}
                >
                  <span className="relative z-10">حسابي</span>
                  {/* Shimmer on hover */}
                  <span
                    className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
                    style={{
                      background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)`,
                    }}
                  />
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm px-2.5 py-2.5 rounded-xl transition-all duration-300 hover:bg-red-500/10 hover:text-red-500 font-medium"
                  style={{ color: 'var(--text-muted)' }}
                >
                  خروج
                </button>
              </div>
            ) : (
              <Link
                href={hideNav ? '?login=true' : '/login'}
                className="relative text-sm font-bold px-4 py-2.5 rounded-xl text-white transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 overflow-hidden group/btn ripple-btn"
                style={{ backgroundColor: primaryColor }}
              >
                <span className="relative z-10">دخول</span>
                {/* Shimmer on hover */}
                <span
                  className="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700"
                  style={{
                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)`,
                  }}
                />
              </Link>
            )}

            {/* Mobile Menu Toggle */}
            {!hideNav && (
              <button
                onClick={() => setMobileMenu(!mobileMenu)}
                className="sm:hidden relative p-2.5 rounded-xl border transition-all duration-300 hover:shadow-md"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                aria-label="القائمة"
              >
                <svg className="w-5 h-5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {mobileMenu ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenu && !hideNav && (
          <div
            className="sm:hidden border-t overflow-hidden animate-fade-down"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--glass-bg)', backdropFilter: 'blur(20px)' }}
          >
            <div className="px-4 py-4 space-y-1">
              <Link
                href="/courses"
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive('/courses') ? 'text-white shadow-md' : 'hover:scale-[1.02] active:scale-[0.98]'
                }`}
                style={{
                  backgroundColor: isActive('/courses') ? primaryColor : 'transparent',
                  color: isActive('/courses') ? '#fff' : 'var(--text)',
                }}
                onClick={() => setMobileMenu(false)}
              >
                <span className="text-base transition-transform duration-300 group-hover:scale-110">📚</span>
                البرامج
              </Link>
              <Link
                href="/verify"
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive('/verify') ? 'text-white shadow-md' : 'hover:scale-[1.02] active:scale-[0.98]'
                }`}
                style={{
                  backgroundColor: isActive('/verify') ? primaryColor : 'transparent',
                  color: isActive('/verify') ? '#fff' : 'var(--text)',
                }}
                onClick={() => setMobileMenu(false)}
              >
                <span className="text-base transition-transform duration-300 group-hover:scale-110">🎓</span>
                تحقق من شهادة
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Spacer for fixed header */}
      <div className="h-[57px]" />

      <CartDrawer open={cartDrawer} onClose={() => { setCartDrawer(false); fetchCartCount(); }} />
    </>
  );
}
