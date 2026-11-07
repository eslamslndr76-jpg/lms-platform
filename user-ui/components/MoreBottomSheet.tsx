'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';
import M3BottomSheet from './M3BottomSheet';

interface MoreBottomSheetProps {
  open: boolean;
  onClose: () => void;
}

const SHEET_ITEMS = [
  { href: '/verify', label: 'تحقق من شهادة', icon: 'verified' },
];

export default function MoreBottomSheet({ open, onClose }: MoreBottomSheetProps) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    onClose();
    logout();
    router.push('/');
  };

  return (
    <M3BottomSheet open={open} onClose={onClose} title="المزيد" maxHeightVh={50}>
      <div className="px-2 pb-4">
        {SHEET_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-4 px-5 py-3.5 rounded-md3-md text-sm font-medium transition-colors duration-200"
            style={{ color: 'var(--md-sys-color-on-surface)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-surface-container-highest)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}

        {/* Divider */}
        <div className="my-2 mx-5 h-px" style={{ backgroundColor: 'var(--md-sys-color-outline-variant)' }} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-4 w-full px-5 py-3.5 rounded-md3-md text-sm font-medium transition-colors duration-200"
          style={{ color: 'var(--md-sys-color-error)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--md-sys-color-error-container)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          <span className="material-symbols-outlined text-[22px]">logout</span>
          تسجيل خروج
        </button>
      </div>
    </M3BottomSheet>
  );
}
