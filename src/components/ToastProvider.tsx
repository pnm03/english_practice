'use client';

import React, { createContext, useContext, useMemo, useState } from 'react';

type Toast = {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (message: string, options?: { type?: Toast['type']; durationMs?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, options?: { type?: Toast['type']; durationMs?: number }) => {
    const id = Math.random().toString(36).slice(2);
    const durationMs = options?.durationMs ?? 3000;
    setToasts((prev) => [...prev, { id, message, type: options?.type ?? 'info', durationMs }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  };

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[1000] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-md px-4 py-2 text-sm shadow-md border backdrop-blur bg-white/90 dark:bg-neutral-900/90 ${
              t.type === 'success'
                ? 'border-green-400 text-green-800 dark:text-green-300'
                : t.type === 'error'
                ? 'border-red-400 text-red-800 dark:text-red-300'
                : 'border-neutral-300 text-neutral-800 dark:text-neutral-200'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
} 