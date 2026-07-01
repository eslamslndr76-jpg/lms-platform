'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBranding } from './BrandingProvider';
import { useDarkMode } from './DarkModeProvider';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import CartDrawer from './CartDrawer';

export default function Header() {
  const { systemName, primaryColor, logoHeader } = useBranding();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [cartDrawer, setCartDrawer] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    if (!user) { setCartCount(0); return; }
    try {
      const data = await api('/api/cart');
      setCartCount(data.count || 0);
    } catch { setCartCount(0); }
  }, [user]);

  useEffect(() => { fetchCartCount(); }, [fetchCartCount]);
  useEffect(() => { const onFocus = () => fetchCartCount(); window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus); }, [fetchCartCount]);

  const handleLogout = () => { logout(); router.push('/'); };

  return (
    <>
      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
        <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3">
            {logoHeader ? (
              <img src={logoHeader} alt={systemName} className="h-8" />
            ) : (
              <h1 className="text-lg font-bold" style={{ color: primaryColor }}>{systemName}</h1>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/verify" className="text-xs px-2 py-1 rounded-lg hidden sm:block" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
              تحقق من شهادة
            </Link>
            <button onClick={toggleDark} className="p-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
              {dark ? '☀️' : '🌙'}
            </button>
            {user && (
              <button onClick={() => setCartDrawer(true)} className="relative p-2 rounded-xl border" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                🛒
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-white text-[10px] flex items-center justify-center font-bold" style={{ backgroundColor: '#dc2626' }}>
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>
            )}
            {user ? (
              <>
                <Link href="/account" className="text-sm font-medium px-3 py-2 rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
                  حسابي
                </Link>
                <button onClick={handleLogout} className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  خروج
                </button>
              </>
            ) : (
              <Link href="/login" className="text-sm font-medium px-3 py-2 rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
                دخول
              </Link>
            )}
          </div>
        </div>
      </header>

      <CartDrawer open={cartDrawer} onClose={() => { setCartDrawer(false); fetchCartCount(); }} />
    </>
  );
}
