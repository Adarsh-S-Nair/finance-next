"use client";

/**
 * InvestmentCalculator
 *
 * Full-screen body for the growth-projection tool. Lives inside a Modal opened
 * from CalculatorWidget on the investments page. Controlled: inputs + onChange
 * are owned by the parent so the inline widget and the modal stay in sync, and
 * the projection math comes from lib/investmentProjection.
 *
 * Two conceptual modes are exposed:
 *   - "Growth"   — traditional appreciation investing (broad-market ETFs). Live.
 *   - "Dividend" — income / DRIP investing. Stubbed ("Soon") for now.
 */

import { useMemo } from "react";
import { LineChart } from "@zervo/ui";
import { projectGrowth } from "../../../lib/investmentProjection";

function formatCurrency(value, { compact = false } = {}) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number(value));
}

/* ── Shared projection chart ──────────────────────────────── */

/**
 * Area of total balance (green) with a dashed "contributions" baseline so the
 * gap between the two reads as compounded growth. Reused by the widget preview
 * (small, axis-free) and the modal (taller, with a year axis).
 */
export function ProjectionChart({ points, height = 220, showAxis = false, gradientId = "calcGrowth" }) {
  return (
    <LineChart
      data={points}
      height={height}
      width="100%"
      margin={{ top: 8, right: 0, bottom: showAxis ? 4 : 0, left: 0 }}
      curveType="monotone"
      animationDuration={600}
      showTooltip={false}
      showXAxis={showAxis}
      xAxisDataKey="year"
      xAxisInterval="preserveStartEnd"
      formatXAxis={(v) => (v === 0 ? "Now" : `${v}y`)}
      yAxisDomain={[0, "dataMax"]}
      gradientId={gradientId}
      lines={[
        {
          dataKey: "balance",
          strokeColor: "var(--color-success)",
          strokeWidth: 2,
          showArea: true,
          areaOpacity: 0.16,
          gradientId,
        },
        {
          dataKey: "contributed",
          strokeColor: "var(--color-muted)",
          strokeWidth: 1.5,
          strokeOpacity: 0.7,
          strokeDasharray: "4 4",
          showArea: false,
        },
      ]}
    />
  );
}

/* ── Mode toggle (Growth live, Dividend stubbed) ──────────── */

function ModeToggle({ mode, onChange }) {
  const modes = [
    { value: "growth", label: "Growth", soon: false },
    { value: "dividend", label: "Dividend", soon: true },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-alt)] p-1">
      {modes.map((m) => {
        const isActive = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            disabled={m.soon}
            onClick={() => !m.soon && onChange(m.value)}
            className={`relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors duration-200 ${
              isActive
                ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                : m.soon
                  ? "cursor-not-allowed text-[var(--color-muted)] opacity-60"
                  : "cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {m.label}
            {m.soon && (
              <span className="rounded-full bg-[var(--color-border)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Labelled slider + numeric input field ────────────────── */

function Field({ label, hint, value, onChange, min, max, step, prefix, suffix }) {
  const numeric = value === "" ? min : Number(value);
  const pct = Math.max(0, Math.min(100, ((numeric - min) / (max - min)) * 100));
  const trackBg = `linear-gradient(to right, var(--color-fg) 0%, var(--color-fg) ${pct}%, color-mix(in oklab, var(--color-fg), transparent 88%) ${pct}%, color-mix(in oklab, var(--color-fg), transparent 88%) 100%)`;
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-[var(--color-fg)]">{label}</label>
        <div className="flex items-baseline gap-1 text-sm font-semibold tabular-nums text-[var(--color-fg)]">
          {prefix && <span className="text-[var(--color-muted)]">{prefix}</span>}
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className="w-24 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right tabular-nums outline-none hover:border-[var(--color-border)] focus:border-[var(--color-border)] input-focus-bar"
          />
          {suffix && <span className="text-[var(--color-muted)]">{suffix}</span>}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={numeric}
        onChange={(e) => onChange(Number(e.target.value))}
        className="zervo-slider"
        style={{ background: trackBg }}
        aria-label={label}
      />
      {hint && <div className="mt-2 text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

/* ── Main calculator body ─────────────────────────────────── */

export default function InvestmentCalculator({ inputs, onChange, projection: provided }) {
  const projection = useMemo(
    () => provided || projectGrowth(inputs),
    [provided, inputs]
  );

  const { finalBalance, totalContributed, totalGrowth, points } = projection;
  const growthPct = totalContributed > 0 ? (totalGrowth / totalContributed) * 100 : 0;
  const contribShare = finalBalance > 0 ? (totalContributed / finalBalance) * 100 : 0;

  const patch = (key) => (v) => onChange({ [key]: v });

  return (
    <div className="flex flex-col gap-6">
      <ModeToggle mode={inputs.mode} onChange={patch("mode")} />

      {/* Headline result */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Projected value in {inputs.years} years
        </div>
        <div className="mt-1 text-4xl font-semibold tabular-nums text-[var(--color-fg)]">
          {formatCurrency(finalBalance)}
        </div>
        <div className="mt-1 text-sm text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-success)]">
            +{formatCurrency(totalGrowth)}
          </span>{" "}
          of growth on {formatCurrency(totalContributed)} invested
          <span className="text-[var(--color-muted)]"> ({growthPct.toFixed(0)}% return)</span>
        </div>
      </div>

      {/* Chart */}
      <ProjectionChart points={points} height={240} showAxis gradientId="calcModalGrowth" />

      {/* Contributions vs growth breakdown bar */}
      <div>
        <div className="mb-2 flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
          <div
            className="h-full bg-[var(--color-muted)]"
            style={{ width: `${contribShare}%`, opacity: 0.5 }}
          />
          <div className="h-full flex-1 bg-[var(--color-success)]" />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-muted)] opacity-50" />
            Contributions {formatCurrency(totalContributed, { compact: true })}
          </span>
          <span className="flex items-center gap-1.5 text-[var(--color-muted)]">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success)]" />
            Growth {formatCurrency(totalGrowth, { compact: true })}
          </span>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          label="Starting balance"
          prefix="$"
          value={inputs.initial}
          onChange={patch("initial")}
          min={0}
          max={500000}
          step={500}
        />
        <Field
          label="Monthly contribution"
          prefix="$"
          value={inputs.monthly}
          onChange={patch("monthly")}
          min={0}
          max={10000}
          step={50}
        />
        <Field
          label="Annual return"
          suffix="%"
          value={inputs.annualReturnPct}
          onChange={patch("annualReturnPct")}
          min={1}
          max={15}
          step={0.5}
          hint="S&P 500 has averaged ~7% after inflation."
        />
        <Field
          label="Time horizon"
          suffix="yr"
          value={inputs.years}
          onChange={patch("years")}
          min={1}
          max={50}
          step={1}
        />
        <Field
          label="Annual contribution increase"
          suffix="%"
          value={inputs.annualIncreasePct}
          onChange={patch("annualIncreasePct")}
          min={0}
          max={15}
          step={0.5}
          hint="Bump your monthly amount each year (e.g. for raises)."
        />
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-muted)]">
        Estimates only. Assumes a constant annual return compounded monthly and
        excludes taxes and fees. Real markets vary year to year.
      </p>
    </div>
  );
}
