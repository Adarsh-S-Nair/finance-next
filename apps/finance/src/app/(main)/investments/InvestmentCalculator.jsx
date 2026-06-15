"use client";

/**
 * InvestmentCalculator
 *
 * Body of the growth/dividend projection tool, rendered inside the full-screen
 * calculator overlay opened from CalculatorWidget. Controlled: inputs + onChange
 * are owned by the parent so the inline widget and the modal stay in sync, and
 * the projection math comes from lib/investmentProjection.
 *
 * Two modes, both live:
 *   - "Growth"   — traditional appreciation investing (broad-market ETFs).
 *   - "Dividend" — income / DRIP investing; headline is annual passive income.
 */

import { useMemo } from "react";
import { projectGrowth, projectDividend } from "../../../lib/investmentProjection";

function formatCurrency(value, { compact = false } = {}) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(Number(value));
}

/* ── Mode toggle ──────────────────────────────────────────── */

function ModeToggle({ mode, onChange }) {
  const modes = [
    { value: "growth", label: "Growth" },
    { value: "dividend", label: "Dividend" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface)] p-1">
      {modes.map((m) => {
        const isActive = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors duration-200 ${
              isActive
                ? "bg-[var(--color-fg)] text-[var(--color-bg)]"
                : "cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            }`}
          >
            {m.label}
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

/* ── DRIP toggle (dividend mode) ──────────────────────────── */

function ReinvestToggle({ value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-[var(--color-fg)]">Reinvest dividends (DRIP)</div>
        <div className="mt-0.5 text-xs text-[var(--color-muted)]">
          Buy more shares with each payout so income compounds.
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${
          value ? "bg-[var(--color-fg)]" : "bg-[var(--color-border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--color-bg)] shadow transition-transform duration-200 ${
            value ? "translate-x-[1.375rem]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/* ── Summary stat ─────────────────────────────────────────── */

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-xs font-medium text-[var(--color-muted)]">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold tabular-nums ${
          accent ? "text-[var(--color-success)]" : "text-[var(--color-fg)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Main calculator body ─────────────────────────────────── */

export default function InvestmentCalculator({ inputs, onChange }) {
  const isDividend = inputs.mode === "dividend";

  const projection = useMemo(
    () => (isDividend ? projectDividend(inputs) : projectGrowth(inputs)),
    [isDividend, inputs]
  );

  const patch = (key) => (v) => onChange({ [key]: v });

  return (
    <div className="flex flex-col gap-7">
      <ModeToggle mode={inputs.mode} onChange={patch("mode")} />

      {isDividend ? (
        <DividendView projection={projection} inputs={inputs} />
      ) : (
        <GrowthView projection={projection} inputs={inputs} />
      )}

      {/* Inputs */}
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
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

        {isDividend ? (
          <>
            <Field
              label="Dividend yield"
              suffix="%"
              value={inputs.dividendYieldPct}
              onChange={patch("dividendYieldPct")}
              min={0}
              max={12}
              step={0.1}
              hint="Annual payout as a % of value. Broad dividend ETFs run ~2–4%."
            />
            <Field
              label="Dividend growth"
              suffix="%"
              value={inputs.dividendGrowthPct}
              onChange={patch("dividendGrowthPct")}
              min={0}
              max={15}
              step={0.5}
              hint="How fast the dividend itself grows each year."
            />
            <Field
              label="Price appreciation"
              suffix="%"
              value={inputs.priceAppreciationPct}
              onChange={patch("priceAppreciationPct")}
              min={0}
              max={12}
              step={0.5}
              hint="Share-price growth on top of dividends."
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
            <div className="sm:col-span-2">
              <ReinvestToggle value={inputs.reinvest} onChange={patch("reinvest")} />
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      <p className="text-xs leading-relaxed text-[var(--color-muted)]">
        Estimates only. Assumes constant rates compounded monthly and excludes
        taxes and fees. Real markets vary year to year.
      </p>
    </div>
  );
}

/* ── Mode-specific headline + summary ─────────────────────── */

function GrowthView({ projection, inputs }) {
  const { finalBalance, totalContributed, totalGrowth } = projection;
  const growthPct = totalContributed > 0 ? (totalGrowth / totalContributed) * 100 : 0;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Projected value in {inputs.years} years
      </div>
      <div className="mt-1 text-4xl font-semibold tabular-nums text-[var(--color-fg)]">
        {formatCurrency(finalBalance)}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="You invest" value={formatCurrency(totalContributed)} />
        <Stat label="Growth" value={`+${formatCurrency(totalGrowth)}`} accent />
        <Stat label="Total return" value={`${growthPct.toFixed(0)}%`} />
      </div>
    </div>
  );
}

function DividendView({ projection, inputs }) {
  const { finalBalance, totalContributed, totalDividends, finalAnnualIncome } = projection;
  const monthlyIncome = finalAnnualIncome / 12;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        Annual dividend income in {inputs.years} years
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums text-[var(--color-success)]">
          {formatCurrency(finalAnnualIncome)}
        </span>
        <span className="text-sm text-[var(--color-muted)]">
          ≈ {formatCurrency(monthlyIncome)}/mo
        </span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Portfolio value" value={formatCurrency(finalBalance)} />
        <Stat label="You invest" value={formatCurrency(totalContributed)} />
        <Stat label="Dividends earned" value={`+${formatCurrency(totalDividends)}`} accent />
      </div>
    </div>
  );
}
