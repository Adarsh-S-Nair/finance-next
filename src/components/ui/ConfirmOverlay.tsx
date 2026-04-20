"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import OverlayButton from "./OverlayButton";

type Variant = "primary" | "danger";

type ConfirmOverlayProps = {
  isOpen: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  busy?: boolean;
  /** @deprecated — OverlayButton handles the loading spinner. Kept optional for compat. */
  busyLabel?: string;
  /** If set, the user has to type this string before the confirm button enables. */
  requiredText?: string;
  /** Display the required text uppercased in the placeholder. */
  showRequiredTextUppercase?: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
};

/**
 * Full-screen confirmation overlay matching the aesthetic of
 * AddAccountOverlay / HouseholdSwitcherModal: plain content-bg backdrop,
 * close button in the top-right, centered column with a 26px headline and
 * muted description, and a minimal action row (ghost Cancel + chevron
 * Confirm). Replaces the legacy Modal-based ConfirmDialog.
 */
export default function ConfirmOverlay({
  isOpen,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  busy = false,
  requiredText,
  showRequiredTextUppercase = false,
  onCancel,
  onConfirm,
}: ConfirmOverlayProps) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setValue("");
    setSubmitting(false);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onCancel]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const requiredOk = useMemo(() => {
    if (!requiredText) return true;
    return value.trim().toLowerCase() === requiredText.trim().toLowerCase();
  }, [requiredText, value]);

  const disabled = busy || submitting || !requiredOk;

  const handleConfirm = async () => {
    if (disabled) return;
    try {
      setSubmitting(true);
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  if (typeof document === "undefined") return null;

  const displayValue = showRequiredTextUppercase ? value.toUpperCase() : value;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="confirm-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-[var(--color-content-bg)] overflow-y-auto"
        >
          <button
            type="button"
            onClick={onCancel}
            className="fixed top-5 right-5 md:top-6 md:right-6 z-10 p-2 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>

          <div className="min-h-screen flex items-center justify-center px-6 py-20">
            <div className="w-full max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]">
                  {title}
                </h1>
                {description && (
                  <p className="mt-2 text-sm text-[var(--color-muted)]">{description}</p>
                )}

                {requiredText && (
                  <div className="mt-8">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)] mb-2">
                      Type &ldquo;{showRequiredTextUppercase ? requiredText.toUpperCase() : requiredText}&rdquo; to confirm
                    </label>
                    <input
                      autoFocus
                      value={displayValue}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={showRequiredTextUppercase ? requiredText.toUpperCase() : requiredText}
                      className="w-full border-0 border-b border-[var(--color-border)] bg-transparent pb-2 text-lg text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/40 outline-none focus:border-[var(--color-fg)] transition-colors"
                    />
                  </div>
                )}

                <div className="mt-10 flex items-center gap-6">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={busy || submitting}
                    className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-50"
                  >
                    {cancelLabel}
                  </button>
                  <OverlayButton
                    onClick={handleConfirm}
                    loading={busy || submitting}
                    disabled={!requiredOk}
                    variant={variant}
                  >
                    {confirmLabel}
                  </OverlayButton>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
