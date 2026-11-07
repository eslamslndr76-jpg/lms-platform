'use client';

import { useState, useRef, useEffect, createContext, useContext, ReactNode } from 'react';

interface Toast { id: number; message: string; type: 'success' | 'error'; }

const ToastContext = createContext<{ show: (msg: string, type?: 'success' | 'error') => void }>({
  show: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(0);

  const show = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++nextIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center max-w-md w-[calc(100%-2rem)]">
        {toasts.map(t => (
          <div
            key={t.id}
            className="w-full px-4 py-3 rounded-md3-sm text-sm font-medium shadow-lg transition-all animate-slide-up flex items-center gap-3"
            style={{
              backgroundColor: 'var(--md-sys-color-inverse-surface)',
              color: 'var(--md-sys-color-inverse-on-surface)',
            }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--md-sys-color-inverse-primary)' }}>
              {t.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
