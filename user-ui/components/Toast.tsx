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
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg transition-all animate-slide-up ${
              t.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {t.type === 'success' ? '✓ ' : '✕ '}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
