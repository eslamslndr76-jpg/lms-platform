'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDarkMode } from './DarkModeProvider';
import NotificationBell from './NotificationBell';

/** Route → page title for the top app bar. */
const TITLE_BY_PATH: [string, string][] = [
  ['/courses', 'الكورسات'],
  ['/proposals', 'مقترحات الكورسات'],
  ['/orders', 'الطلبات'],
  ['/students', 'الطلاب'],
  ['/certificates', 'الشهادات'],
  ['/financials', 'المالية'],
  ['/permissions', 'المستخدمون والصلاحيات'],
  ['/employees', 'الموظفون'],
  ['/settings', 'الإعدادات'],
  ['/account', 'حسابي'],
];

export default function TopAppBar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { dark, toggle: toggleDark } = useDarkMode();

  const title =
    TITLE_BY_PATH.find(([prefix]) => pathname === prefix || pathname?.startsWith(prefix + '/'))?.[1] ||
    'لوحة التحكم';

  return (
    <header
      className="fixed top-0 right-0 left-0 h-16 z-30 flex items-center gap-2 px-3 sm:px-5 border-b"
      style={{
        backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
        borderColor: 'var(--md-sys-color-outline-variant)',
      }}
    >
      {/* Menu — mobile only (the desktop drawer is always visible) */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="فتح القائمة"
        className="md3-btn md3-btn--icon lg:hidden shrink-0"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
      </button>

      <h1 className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--md-sys-color-on-surface)' }}>
        {title}
      </h1>

      <div className="flex-1" />

      <button
        type="button"
        onClick={toggleDark}
        aria-label={dark ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع الداكن'}
        className="md3-btn md3-btn--icon"
      >
        <span className="material-symbols-outlined text-[22px]">{dark ? 'light_mode' : 'dark_mode'}</span>
      </button>

      <NotificationBell />

      <Link
        href="/account"
        aria-label="حسابي"
        className="md3-btn md3-btn--icon"
        title="حسابي"
      >
        <span className="material-symbols-outlined text-[22px]">account_circle</span>
      </Link>
    </header>
  );
}
