"use client";

import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCircleXmark, FaCircleCheck } from "react-icons/fa6";
import { RiErrorWarningFill } from "react-icons/ri";

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
      const handle = window.setTimeout(() => removeToast(id), durationMs + 150);
      timeoutMap.current.set(id, handle);
    },
    [removeToast]
  );

  const value = useMemo(() => ({ setToast, removeToast }), [setToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-h-[100dvh] w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const bgColor =
              t.variant === "success"
                ? "var(--color-accent)"
                : t.variant === "error"
                ? "var(--color-danger)"
                : t.variant === "warning"
                ? "var(--color-warn)"
                : "var(--color-ring)";
            const fgColor = "#ffffff";
            const trackColor = `color-mix(in_oklab, ${bgColor}, black 18%)`;
            const fillColor = `color-mix(in_oklab, ${bgColor}, black 34%)`;

            return (
              <motion.div
                key={t.id}
                initial={{ x: 24, y: 0, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={{ x: 24, opacity: 0 }}
                transition={{ type: "spring", stiffness: 520, damping: 40, mass: 0.6 }}
                className="pointer-events-auto relative overflow-hidden rounded-lg shadow-lg"
                role="status"
                aria-live="polite"
              >
                <div className="relative flex items-start gap-3 p-3 pr-8" style={{ backgroundColor: bgColor, color: fgColor }}>
                  <div className="mt-0.5">
                    {t.variant === "error" && <FaCircleXmark aria-hidden className="h-5 w-5" />}
                    {t.variant === "warning" && <RiErrorWarningFill aria-hidden className="h-5 w-5" />}
                    {t.variant === "success" && <FaCircleCheck aria-hidden className="h-5 w-5" />}
                    {t.variant === "info" && <RiErrorWarningFill aria-hidden className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    {t.title && <div className="text-sm font-semibold">{t.title}</div>}
                    {t.description && <div className="mt-0.5 text-sm opacity-90">{t.description}</div>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeToast(t.id)}
                    className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md hover:opacity-80"
                    aria-label="Dismiss"
                    style={{ color: fgColor }}
                  >
                    ×
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 h-[3px] w-full" style={{ backgroundColor: trackColor }} />
                <div
                  className="absolute bottom-0 left-0 h-[3px]"
                  style={{
                    backgroundColor: fillColor,
                    animationName: "toastProgress",
                    animationTimingFunction: "linear",
                    animationDuration: `${t.durationMs}ms`,
                    animationFillMode: "forwards",
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}


