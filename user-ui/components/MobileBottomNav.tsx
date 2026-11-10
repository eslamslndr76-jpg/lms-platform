'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import MoreBottomSheet from './MoreBottomSheet';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'الرئيسية', icon: 'dashboard' },
  { href: '/my-courses', label: 'كورساتي', icon: 'school' },
  { href: '/orders', label: 'طلباتي', icon: 'receipt_long' },
  { href: '/cart', label: 'السلة', icon: 'shopping_cart' },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api('/api/cart');
      setCartCount(data.count || 0);
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => { fetchCart(); }, [fetchCart]);
  useEffect(() => {
    const onFocus = () => fetchCart();
    window.addEventListener('focus', onFocus);
    window.addEventListener('cart:updated', onFocus);
    return () => { window.removeEventListener('focus', onFocus); window.removeEventListener('cart:updated', onFocus); };
  }, [fetchCart]);

  if (!user) return null;

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    if (href === '/cart') return pathname === '/cart' || pathname.startsWith('/checkout');
    return pathname?.startsWith(href);
  };

  // More is "active" when on account, verify, or other non-primary pages
  const isMoreActive = pathname?.startsWith('/account') || pathname?.startsWith('/verify');

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-3 left-3 right-3 z-50 flex items-center justify-around h-[60px] px-1"
        style={{
          borderRadius: 'var(--md-sys-shape-corner-extra-large)',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          boxShadow: '0 2px 6px 2px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.3)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full py-1 relative"
              style={{
                color: active
                  ? 'var(--md-sys-color-on-secondary-container)'
                  : 'var(--md-sys-color-on-surface-variant)',
              }}
            >
              {active && (
                <div
                  className="absolute top-1 w-16 h-8"
                  style={{
                    borderRadius: 'var(--md-sys-shape-corner-full)',
                    backgroundColor: 'var(--md-sys-color-secondary-container)',
                  }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center gap-0.5">
                <div className="relative">
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontVariationSettings: active ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
                      fontSize: '24px',
                    }}
                  >
                    {item.icon}
                  </span>
                  {item.icon === 'shopping_cart' && cartCount > 0 && (
                    <span
                      className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                      style={{
                        backgroundColor: 'var(--md-sys-color-error)',
                        color: 'var(--md-sys-color-on-error)',
                      }}
                    >
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </div>
                <span
                  className="text-[11px] leading-none"
                  style={{
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full py-1 relative"
          style={{
            color: isMoreActive
              ? 'var(--md-sys-color-on-secondary-container)'
              : 'var(--md-sys-color-on-surface-variant)',
          }}
        >
          {isMoreActive && (
            <div
              className="absolute top-1 w-16 h-8"
              style={{
                borderRadius: 'var(--md-sys-shape-corner-full)',
                backgroundColor: 'var(--md-sys-color-secondary-container)',
              }}
            />
          )}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings: isMoreActive ? "'FILL' 1, 'wght' 500" : "'FILL' 0, 'wght' 400",
                fontSize: '24px',
              }}
            >
              more_horiz
            </span>
            <span
              className="text-[11px] leading-none"
              style={{
                fontWeight: isMoreActive ? 600 : 400,
              }}
            >
              المزيد
            </span>
          </div>
        </button>
      </nav>

      <MoreBottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
