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
import { LuMaximize2, LuTrendingUp } from "react-icons/lu";
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

  const investValue = formatCompact(projection.totalContributed);
  const gainLabel = isDividend ? "Dividends" : "Growth";
  const gainValue = formatCompact(
    isDividend ? projection.totalDividends : projection.totalGrowth
  );

  return (
    <>
      <div className="relative w-full overflow-hidden rounded-2xl bg-[var(--color-surface-alt)] p-5">
        {/* Soft accent glow in the corner for a little depth. */}
        <div className="pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full bg-[var(--color-success)] opacity-[0.08] blur-2xl" />

        <div className="relative flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface)] text-[var(--color-success)]">
              <LuTrendingUp className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-fg)]">Calculator</div>
              <div className="text-[11px] text-[var(--color-muted)]">
                Growth &amp; dividend projector
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]"
            aria-label="Open calculator"
          >
            <LuMaximize2 className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            {context}
          </div>
          <div className="mt-1.5 text-[2rem] font-semibold leading-none tabular-nums text-[var(--color-fg)]">
            {headline}
          </div>
          <div className="mt-2 text-xs text-[var(--color-muted)]">{subline}</div>
        </div>

        <div className="relative mt-5 flex items-center gap-6 border-t border-[var(--color-border)] pt-4">
          <div>
            <div className="text-[11px] text-[var(--color-muted)]">You invest</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--color-fg)]">
              {investValue}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-[var(--color-muted)]">{gainLabel}</div>
            <div className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--color-success)]">
              +{gainValue}
            </div>
          </div>
        </div>
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
