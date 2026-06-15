"use client";

/**
 * CalculatorWidget
 *
 * Compact growth-projection card for the investments-page right column. Owns the
 * calculator state so the inline preview and the expanded modal share one source
 * of truth — play with it in the modal, close it, and the widget reflects the
 * latest numbers. "Expand" opens the full InvestmentCalculator in a Modal.
 *
 * Seeds the starting balance from the user's actual portfolio value so the
 * projection is personal out of the box.
 */

import { useMemo, useState } from "react";
import { LuMaximize2, LuTrendingUp } from "react-icons/lu";
import { Modal } from "@zervo/ui";
import { projectGrowth } from "../../../lib/investmentProjection";
import InvestmentCalculator, { ProjectionChart } from "./InvestmentCalculator";

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
    annualReturnPct: 7,
    years: 30,
    annualIncreasePct: 0,
  };
}

export default function CalculatorWidget({ currentValue = 0 }) {
  const [inputs, setInputs] = useState(() => defaultInputs(currentValue));
  const [open, setOpen] = useState(false);

  const projection = useMemo(() => projectGrowth(inputs), [inputs]);
  const patch = (partial) => setInputs((prev) => ({ ...prev, ...partial }));

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div className="card-header">Growth projector</div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-fg)]"
          aria-label="Expand calculator"
        >
          <LuMaximize2 className="h-3.5 w-3.5" />
          Expand
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex flex-col text-left"
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)]">
          <LuTrendingUp className="h-3.5 w-3.5" />
          In {inputs.years} years, investing {formatCompact(inputs.monthly)}/mo
        </div>
        <div className="mt-1.5 text-3xl font-semibold tabular-nums text-[var(--color-fg)]">
          {formatCompact(projection.finalBalance)}
        </div>
        <div className="mt-1 text-sm text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-success)]">
            +{formatCompact(projection.totalGrowth)}
          </span>{" "}
          projected growth
        </div>

        <div className="mt-4 -mx-1">
          <ProjectionChart points={projection.points} height={96} gradientId="calcWidgetGrowth" />
        </div>

        <span className="mt-3 text-xs font-medium text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-fg)]">
          Tap to customize ›
        </span>
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        size="lg"
        title="Growth projector"
        description="See how steady investing compounds over time."
      >
        <InvestmentCalculator inputs={inputs} onChange={patch} projection={projection} />
      </Modal>
    </div>
  );
}
