"use client";

import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheck, FiAlertCircle, FiInfo } from "react-icons/fi";

type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastOptions = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type Toast = Required<Pick<ToastOptions, "variant">> & ToastOptions & { id: string; createdAt: number; durationMs: number };

type ToastContextValue = {
  setToast: (options: ToastOptions) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}

const VARIANT_CONFIG = {
  success: {
    icon: FiCheck,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  error: {
    icon: FiAlertCircle,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
  },
  warning: {
    icon: FiAlertCircle,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
  },
  info: {
    icon: FiInfo,
    iconBg: "bg-zinc-100",
    iconColor: "text-zinc-500",
  },
};

export default function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutMap = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timeoutMap.current.get(id);
    if (handle) {
      window.clearTimeout(handle);
      timeoutMap.current.delete(id);
    }
  }, []);

  const setToast = useCallback(
    (options: ToastOptions) => {
      const id = Math.random().toString(36).slice(2);
      const durationMs = options.durationMs ?? 4000;
      const toast: Toast = {
        id,
        title: options.title,
        description: options.description,
        variant: options.variant ?? "info",
        createdAt: Date.now(),
        durationMs,
      };
      setToasts((prev) => [...prev, toast]);
      const handle = window.setTimeout(() => removeToast(id), durationMs + 300);
      timeoutMap.current.set(id, handle);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ setToast, removeToast }), [setToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex max-h-[100dvh] w-full max-w-[360px] flex-col-reverse gap-2.5">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const config = VARIANT_CONFIG[t.variant];
            const Icon = config.icon;

            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
                className="pointer-events-auto relative flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.08)]"
                role="status"
                aria-live="polite"
              >
                <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${config.iconBg}`}>
                  <Icon className={`h-3.5 w-3.5 ${config.iconColor}`} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  {t.title && (
                    <div className="text-[13px] font-semibold text-zinc-900 leading-tight">{t.title}</div>
                  )}
                  {t.description && (
                    <div className="mt-0.5 text-[13px] text-zinc-500 leading-snug">{t.description}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeToast(t.id)}
                  className="mt-0.5 flex-shrink-0 inline-flex h-5 w-5 items-center justify-center rounded-md text-zinc-300 hover:text-zinc-500 transition-colors"
                  aria-label="Dismiss"
                >
                  <FiX className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
