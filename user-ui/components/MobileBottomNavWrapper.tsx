'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth';
import MobileBottomNav from './MobileBottomNav';

const HIDDEN_PATHS = ['/login', '/register', '/forgot-password', '/verify'];

export default function MobileBottomNavWrapper() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading || !user) return null;
  if (HIDDEN_PATHS.some((p) => pathname?.startsWith(p))) return null;

  return <MobileBottomNav />;
}
