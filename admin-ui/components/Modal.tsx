'use client';

import { ReactNode } from 'react';

export default function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 animate-scale-in" style={{ backgroundColor: 'var(--card)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{title}</h3>
          <button onClick={onClose} className="transition-colors" style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
