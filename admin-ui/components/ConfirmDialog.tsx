'use client';

import { ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء',
  variant = 'danger', onConfirm, onCancel, loading,
}: ConfirmDialogProps) {
  if (!open) return null;

  const iconTokens = {
    danger: { bg: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' },
    warning: { bg: 'var(--md-sys-color-warning-container)', color: 'var(--md-sys-color-on-warning-container)' },
    info: { bg: 'var(--md-sys-color-info-container)', color: 'var(--md-sys-color-on-info-container)' },
  };
  const icon = variant === 'danger' ? '⚠️' : variant === 'warning' ? '⚡' : 'ℹ️';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="relative md3-elevation-3 w-full max-w-sm p-6 animate-scale-in text-center"
        style={{
          backgroundColor: 'var(--md-sys-color-surface-container-high)',
          borderRadius: 'var(--md-sys-shape-corner-extra-large)',
        }}
      >
        <div
          className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl"
          style={{ backgroundColor: iconTokens[variant].bg, color: iconTokens[variant].color }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>{title}</h3>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="md3-btn md3-btn--outlined flex-1"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`md3-btn flex-1 ${variant === 'danger' ? 'md3-btn--danger' : variant === 'warning' ? 'md3-btn--tonal' : 'md3-btn--filled'}`}
          >
            {loading ? 'جاري...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
