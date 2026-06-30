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

  const confirmColors = {
    danger: '#dc2626',
    warning: '#f59e0b',
    info: 'var(--primary)',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in text-center" style={{ backgroundColor: 'var(--card)' }}>
        <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl"
          style={{ backgroundColor: variant === 'danger' ? '#fef2f2' : variant === 'warning' ? '#fffbeb' : '#eff6ff' }}>
          {variant === 'danger' ? '⚠️' : variant === 'warning' ? '⚡' : 'ℹ️'}
        </div>
        <h3 className="font-bold text-lg mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all hover:opacity-80 disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: confirmColors[variant] }}>
            {loading ? 'جاري...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
