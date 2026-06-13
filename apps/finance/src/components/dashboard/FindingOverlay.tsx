"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import { Button } from "@zervo/ui";
import { authFetch } from "../../lib/api/fetch";

/**
 * Full-screen finding detail — the assistant's "how I got here" view,
 * styled like the sign-out overlay (content-bg takeover, close in the
 * corner, centered column). Shows the detector's step-by-step reasoning
 * so the user can audit the number, and lets them dismiss it. Surfaces
 * are square; the action is a rounded button.
 */

type Severity = "action" | "review" | "info";

interface ReasoningStep {
  label: string;
  value: string;
  note?: string;
}

export interface OverlayFinding {
  id: string;
  severity: Severity;
  title: string;
  body: string;
  evidence: { reasoning?: ReasoningStep[] } | null;
}

const SEVERITY: Record<Severity, { rail: string; label: string }> = {
  action: { rail: "var(--color-danger)", label: "Action recommended" },
  review: { rail: "var(--color-warn)", label: "Worth a look" },
  info: { rail: "var(--color-success)", label: "Good to know" },
};

export default function FindingOverlay({
  finding,
  onClose,
  onDismissed,
}: {
  finding: OverlayFinding | null;
  onClose: () => void;
  onDismissed: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!finding) return;
    setBusy(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [finding, onClose]);

  if (typeof document === "undefined") return null;

  async function dismiss() {
    if (!finding) return;
    setBusy(true);
    try {
      await authFetch(`/api/agent/findings/${finding.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dismissed" }),
      });
      onDismissed(finding.id);
    } finally {
      setBusy(false);
    }
  }

  const sev = finding ? SEVERITY[finding.severity] ?? SEVERITY.review : SEVERITY.review;
  const steps = finding?.evidence?.reasoning ?? [];

  return createPortal(
    <AnimatePresence>
      {finding && (
        <motion.div
          key="finding-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--color-content-bg)]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="fixed right-5 top-5 z-10 rounded-full p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)] md:right-6 md:top-6"
          >
            <FiX className="h-5 w-5" />
          </button>

          <div className="flex min-h-screen items-center justify-center px-6 py-20">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-md"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                {sev.label}
              </span>
              <h1 className="mt-2 text-[26px] font-medium leading-tight tracking-tight text-[var(--color-fg)]">
                {finding.title}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                {finding.body}
              </p>

              {steps.length > 0 && (
                <div className="mt-8">
                  <div className="card-header mb-3">How the assistant got here</div>
                  <div className="relative bg-[var(--color-surface-alt)]">
                    <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: sev.rail }} />
                    <div className="divide-y divide-[var(--color-border)] pl-2">
                      {steps.map((step, i) => (
                        <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-3.5">
                          <div className="min-w-0">
                            <div className="text-sm text-[var(--color-fg)]">{step.label}</div>
                            {step.note && (
                              <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                                {step.note}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-fg)]">
                            {step.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-10 flex items-center gap-6">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                >
                  Close
                </button>
                <Button onClick={dismiss} loading={busy} variant="primary">
                  Dismiss
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
