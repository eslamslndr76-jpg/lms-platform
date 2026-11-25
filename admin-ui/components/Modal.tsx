'use client';

import { ReactNode, useEffect, useRef } from 'react';

const sizeMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export default function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Esc closes; Tab is trapped inside the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Move initial focus into the dialog.
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    const target = dialogRef.current.querySelector<HTMLElement>('[data-autofocus]') ||
      dialogRef.current.querySelector<HTMLElement>('button, [href], input, select, textarea');
    target?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative md3-elevation-3 w-full ${sizeMap[size]} max-h-[90vh] overflow-y-auto animate-scale-in p-6`}
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          borderRadius: 'var(--md-sys-shape-corner-extra-large)',
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-lg" style={{ color: 'var(--md-sys-color-on-surface)' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="md3-btn md3-btn--icon shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
