'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBranding } from './BrandingProvider';
import { useDarkMode } from './DarkModeProvider';
import { useAuth } from '../lib/auth';

export default function Header() {
  const { systemName, sloganAr, primaryColor, logoHeader } = useBranding();
  const { dark, toggle: toggleDark } = useDarkMode();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/'); };

  return (
    <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
      <div className="px-4 py-3 flex items-center justify-between max-w-6xl mx-auto">
        <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-3">
          {logoHeader ? (
            <img src={logoHeader} alt={systemName} className="h-8" />
          ) : (
            <h1 className="text-lg font-bold" style={{ color: primaryColor }}>{systemName}</h1>
          )}
          {sloganAr && <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>{sloganAr}</span>}
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/verify" className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-muted)' }}>
            تحقق من شهادة
          </Link>
          <button onClick={toggleDark} className="p-2 rounded-xl border text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            {dark ? '☀️' : '🌙'}
          </button>
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
  );
}
