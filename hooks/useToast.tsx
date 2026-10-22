import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
  image?: string | null;
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<Toast, 'id' | 'type'>;

interface ToastContextValue {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  show: (type: ToastType, toast: ToastInput, durationMs?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-folha" aria-hidden />,
  error: <XCircle className="h-5 w-5 text-red-600" aria-hidden />,
  warning: <TriangleAlert className="h-5 w-5 text-trigo-dark" aria-hidden />,
  info: <Info className="h-5 w-5 text-pasto" aria-hidden />,
};

const BORDERS = {
  success: 'border-l-folha',
  error: 'border-l-red-500',
  warning: 'border-l-trigo',
  info: 'border-l-pasto',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (type: ToastType, toast: ToastInput, durationMs = 5000) => {
      const id = ++counter.current;
      setToasts((t) => [...t.slice(-4), { ...toast, id, type }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (title, description) => show('success', { title, description }),
      error: (title, description) => show('error', { title, description }, 7000),
      info: (title, description) => show('info', { title, description }),
      warning: (title, description) => show('warning', { title, description }, 6000),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:top-4 sm:items-end"
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`glass-strong pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-2xl border-l-4 p-4 ${BORDERS[toast.type]}`}
          >
            {toast.image ? (
              <img src={toast.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="mt-0.5 shrink-0">{ICONS[toast.type]}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-grafite">{toast.title}</p>
              {toast.description && <p className="mt-0.5 text-sm text-grafite/75">{toast.description}</p>}
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismiss(toast.id);
                  }}
                  className="mt-2 text-sm font-semibold text-pasto hover:text-folha"
                >
                  {toast.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-lg p-1 text-grafite/50 transition hover:bg-black/5 hover:text-grafite"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider');
  return ctx;
}
