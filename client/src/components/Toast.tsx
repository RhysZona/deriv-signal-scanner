import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

interface ToastItem {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

interface ToastContextValue {
  success: (msg: string) => void;
  error: (msg: string) => void;
}

// ── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

// ── Provider ────────────────────────────────────────────────────────────────

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const add = useCallback(
    (message: string, variant: 'success' | 'error') => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-4), { id, message, variant }]);
      const timer = setTimeout(() => remove(id), 3500);
      timersRef.current.set(id, timer);
    },
    [remove],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const value: ToastContextValue = {
    success: useCallback((msg: string) => add(msg, 'success'), [add]),
    error: useCallback((msg: string) => add(msg, 'error'), [add]),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Container — fixed top-right, above everything */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col items-end gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => remove(t.id)}
            className={`pointer-events-auto max-w-xs px-4 py-2.5 rounded-xl shadow-2xl shadow-black/40 border backdrop-blur-sm text-xs font-medium cursor-pointer transition-all duration-300 animate-toast-in ${
              t.variant === 'success'
                ? 'bg-emerald-900/80 border-emerald-700/50 text-emerald-200'
                : 'bg-red-900/80 border-red-700/50 text-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {t.variant === 'success' ? (
                <svg className="w-3.5 h-3.5 shrink-0 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 shrink-0 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span>{t.message}</span>
              <button
                onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                className="ml-1 p-0.5 rounded hover:bg-white/10 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
