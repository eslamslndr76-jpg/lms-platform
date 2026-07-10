'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBranding } from './BrandingProvider';
import { useDarkMode } from './DarkModeProvider';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import CartDrawer from './CartDrawer';

export default function Header({ hideNav = false }: { hideNav?: boolean }) {
  const { systemName, primaryColor, logoHeader } = useBranding();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { user, logout } = useAuth();
  const router = useRouter();
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
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => { logout(); router.push('/'); };

  return (
    <>
      <header className={`fixed top-0 right-0 left-0 z-40 transition-all duration-300 ${scrolled ? 'glass shadow-md' : 'bg-transparent'}`}>
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between max-w-7xl mx-auto">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3 group">
            {logoHeader ? (
              <img src={logoHeader} alt={systemName} className="h-8 sm:h-9 transition-transform group-hover:scale-105" />
            ) : (
              <h1 className="text-lg sm:text-xl font-bold gradient-text">{systemName}</h1>
            )}
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            {!hideNav && (
              <>
                <Link href="/courses" className="hidden sm:inline-flex text-sm px-3 py-2 rounded-xl transition-all hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                  الكورسات
                </Link>
                <Link href="/verify" className="hidden sm:inline-flex text-sm px-3 py-2 rounded-xl transition-all hover:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                  تحقق من شهادة
                </Link>
              </>
            )}

            <button onClick={toggleDark} className="p-2 rounded-xl border transition-all hover:scale-105" style={{ borderColor: 'var(--border)', color: 'var(--text)' }} title={dark ? 'الوضع الفاتح' : 'الوضع المظلم'}>
              <span className="text-lg">{dark ? '☀️' : '🌙'}</span>
            </button>

            {user && (
              <button onClick={() => setCartDrawer(true)} className="relative p-2 rounded-xl border transition-all hover:scale-105" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold" style={{ backgroundColor: '#dc2626' }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-1">
                <Link href="/account" className="text-sm font-medium px-3 sm:px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 hover:scale-105" style={{ backgroundColor: primaryColor }}>
                  حسابي
                </Link>
                <button onClick={handleLogout} className="text-sm px-2 py-2 rounded-xl transition-all hover:bg-red-500/10" style={{ color: 'var(--text-muted)' }}>
                  خروج
                </button>
              </div>
            ) : (
              <Link href={hideNav ? '?login=true' : '/login'} className="text-sm font-medium px-3 sm:px-4 py-2 rounded-xl text-white transition-all hover:opacity-90 hover:scale-105 ripple-btn" style={{ backgroundColor: primaryColor }}>
                دخول
              </Link>
            )}

            {!hideNav && (
              <button onClick={() => setMobileMenu(!mobileMenu)} className="sm:hidden p-2 rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

        {mobileMenu && !hideNav && (
          <div className="sm:hidden border-t glass animate-fade-down" style={{ borderColor: 'var(--border)' }}>
            <div className="px-4 py-3 space-y-2">
              <Link href="/courses" className="block px-3 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setMobileMenu(false)}>
                الكورسات
              </Link>
              <Link href="/verify" className="block px-3 py-2 rounded-xl text-sm" style={{ color: 'var(--text-muted)' }} onClick={() => setMobileMenu(false)}>
                تحقق من شهادة
              </Link>
            </div>
          </div>
        )}
      </header>

      <CartDrawer open={cartDrawer} onClose={() => { setCartDrawer(false); fetchCartCount(); }} />
    </>
  );
}
