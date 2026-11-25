'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

export const useToast = () => useContext(ToastContext);

const icons: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const iconColors: Record<ToastType, string> = {
  success: 'var(--md-sys-color-success)',
  error: 'var(--md-sys-color-error)',
  warning: 'var(--md-sys-color-warning)',
  info: 'var(--md-sys-color-info)',
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-6 left-6 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className="flex items-center gap-3 px-4 py-3 rounded-[var(--md-sys-shape-corner-small)] md3-elevation-3 text-sm font-medium animate-slide-up cursor-pointer"
            style={{
              backgroundColor: 'var(--md-sys-color-inverse-surface)',
              color: 'var(--md-sys-color-inverse-on-surface)',
              borderInlineStart: `4px solid ${iconColors[t.type]}`,
            }}
            onClick={() => removeToast(t.id)}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0" style={{ color: iconColors[t.type] }} aria-hidden="true">
              {icons[t.type]}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
