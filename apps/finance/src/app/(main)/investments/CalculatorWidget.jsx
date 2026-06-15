"use client";

/**
 * CalculatorWidget
 *
 * Compact growth/dividend projector for the investments-page right column.
 * Sits on a surface-alt panel like the dashboard Assistant. Owns the calculator
 * state so the inline preview and the expanded overlay share one source of truth.
 * A single Expand button opens the full InvestmentCalculator in a standard
 * full-screen overlay (same pattern as the sign-out / create-budget modals).
 *
 * Seeds the starting balance from the user's actual portfolio value so the
 * projection is personal out of the box.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import { LuMaximize2 } from "react-icons/lu";
import { projectGrowth, projectDividend } from "../../../lib/investmentProjection";
import InvestmentCalculator from "./InvestmentCalculator";

function formatCompact(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function defaultInputs(currentValue) {
  const seed = Number(currentValue) || 0;
  return {
    mode: "growth",
    // Round the seed to a tidy slider-friendly number; fall back to a sensible
    // starter when the user has no portfolio yet.
    initial: seed > 0 ? Math.round(seed / 500) * 500 : 1000,
    monthly: 500,
    // Growth mode
    annualReturnPct: 7,
    annualIncreasePct: 0,
    years: 30,
    // Dividend mode
    dividendYieldPct: 3.5,
    dividendGrowthPct: 5,
    priceAppreciationPct: 4,
    reinvest: true,
  };
}

export default function CalculatorWidget({ currentValue = 0 }) {
  const [inputs, setInputs] = useState(() => defaultInputs(currentValue));
  const [open, setOpen] = useState(false);

  const isDividend = inputs.mode === "dividend";
  const projection = useMemo(
    () => (isDividend ? projectDividend(inputs) : projectGrowth(inputs)),
    [isDividend, inputs]
  );
  const patch = (partial) => setInputs((prev) => ({ ...prev, ...partial }));

  // Lock background scroll while the overlay is open + close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const headline = isDividend
    ? formatCompact(projection.finalAnnualIncome)
    : formatCompact(projection.finalBalance);
  const context = isDividend
    ? `Annual dividend income in ${inputs.years} years`
    : `Projected value in ${inputs.years} years`;
  const subline = isDividend
    ? `from ${formatCompact(inputs.monthly)}/mo at ${inputs.dividendYieldPct}% yield`
    : `from ${formatCompact(inputs.monthly)}/mo at ${inputs.annualReturnPct}% return`;

  return (
    <>
      <div className="w-full bg-[var(--color-surface-alt)] p-5">
        <div className="flex items-center justify-between">
          <span className="card-header">Calculator</span>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
            aria-label="Open calculator"
          >
            <LuMaximize2 className="h-3.5 w-3.5" />
            Expand
          </button>
        </div>

        <div className="mt-4 text-xs font-medium text-[var(--color-muted)]">{context}</div>
        <div className="mt-1 text-3xl font-semibold tabular-nums text-[var(--color-fg)]">
          {headline}
        </div>
        <div className="mt-1 text-xs text-[var(--color-muted)]">{subline}</div>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="calculator-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--color-content-bg)]"
              >
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="fixed top-5 right-5 z-10 rounded-full p-2 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)] md:top-6 md:right-6"
                  aria-label="Close"
                >
                  <FiX className="h-5 w-5" />
                </button>

                <div className="flex min-h-screen items-center justify-center px-6 py-20">
                  <div className="w-full max-w-2xl">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <h1 className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]">
                        Investment calculator
                      </h1>
                      <p className="mt-2 mb-8 text-sm text-[var(--color-muted)]">
                        See how steady investing compounds over time.
                      </p>
                      <InvestmentCalculator inputs={inputs} onChange={patch} />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
