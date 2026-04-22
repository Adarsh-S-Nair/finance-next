"use client";

/**
 * AllocationCard
 *
 * Segmented bar showing the breakdown of the user's investment portfolio
 * across asset categories (Stocks, Crypto, Cash). Sits beside InvestmentsChart
 * in the top row of the investments page and mirrors the AssetsCard /
 * LiabilitiesCard pattern used on the accounts page.
 *
 * Props:
 *   holdings: Array<{ ticker, shares, asset_type }>
 *   quotes: Record<ticker, { price }>
 *   totalValue: number  // total portfolio value (authoritative number from
 *                       // accounts.balances.current); used as the denominator
 */

import { useMemo, useState } from "react";
import { formatCurrency as formatCurrencyBase } from "../../../lib/formatCurrency";

const formatCurrency = (amount) => formatCurrencyBase(amount || 0, true);

const CATEGORY_ORDER = ["Stocks", "Crypto", "Cash"];

const CATEGORY_COLORS = {
  Stocks: "var(--color-neon-green)",
  Crypto: "var(--color-neon-purple)",
  Cash: "#059669",
};

function categorizeAssetType(assetType) {
  const t = (assetType || "").toLowerCase();
  if (t === "crypto") return "Crypto";
  if (t === "cash") return "Cash";
  return "Stocks"; // default: everything else is a stock/etf/bond/etc.
}

export default function AllocationCard({ holdings, quotes, totalValue }) {
  const [hoveredSegment, setHoveredSegment] = useState(null);

  const { segments, total } = useMemo(() => {
    const totals = { Stocks: 0, Crypto: 0, Cash: 0 };

    for (const h of holdings || []) {
      const category = categorizeAssetType(h.asset_type);
      const shares = Number(h.shares || 0);
      const quote = quotes?.[h.ticker];
      const price = quote?.price;
      // Use live price when available; fall back to cost basis so cash
      // positions (which usually don't have tickers/prices) still contribute.
      const marketValue = price != null ? shares * price : shares * Number(h.avg_cost || 0);
      totals[category] += marketValue;
    }

    const computedTotal =
      totals.Stocks + totals.Crypto + totals.Cash;

    // Use the authoritative accounts total when it's meaningfully larger than
    // what we computed from holdings (covers brokerages that don't expose
    // cash as a holding). Any delta gets assigned to Cash.
    const authoritative = Math.max(computedTotal, totalValue || 0);
    const delta = authoritative - computedTotal;
    if (delta > 0.01) totals.Cash += delta;

    const segs = CATEGORY_ORDER
      .map((label) => ({ label, amount: totals[label] }))
      .filter((s) => s.amount > 0);

    return {
      segments: segs,
      total: segs.reduce((sum, s) => sum + s.amount, 0),
    };
  }, [holdings, quotes, totalValue]);

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <div className="card-header">Allocation</div>
      </div>

      {total === 0 ? (
        <div>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-fg)]">Total Holdings</span>
            <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
              {formatCurrency(0)}
            </span>
          </div>
          <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]" />
          <div className="space-y-3.5">
            {CATEGORY_ORDER.map((label) => (
              <div key={label} className="flex items-center justify-between text-xs opacity-60">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[label] }}
                  />
                  <span className="font-medium text-[var(--color-muted)]">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums text-[var(--color-fg)]">
                    {formatCurrency(0)}
                  </span>
                  <span className="font-medium font-mono text-[10px] text-[var(--color-muted)]">0.0%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-5 flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-fg)]">Total Holdings</span>
            <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
              {formatCurrency(total)}
            </span>
          </div>

          <div
            className="mb-6 flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]"
            onMouseLeave={() => setHoveredSegment(null)}
          >
            {segments.map((segment) => {
              const percentage = (segment.amount / total) * 100;
              const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;
              return (
                <div
                  key={segment.label}
                  className="h-full cursor-pointer transition-all duration-200"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: CATEGORY_COLORS[segment.label],
                    opacity: isDimmed ? 0.3 : 1,
                  }}
                  onMouseEnter={() => setHoveredSegment(segment)}
                />
              );
            })}
          </div>

          <div className="space-y-3.5">
            {segments.map((segment) => {
              const isHovered = hoveredSegment && hoveredSegment.label === segment.label;
              const isDimmed = hoveredSegment && hoveredSegment.label !== segment.label;
              const percentage = ((segment.amount / total) * 100).toFixed(1);
              return (
                <div
                  key={segment.label}
                  className={`flex cursor-pointer items-center justify-between text-xs transition-opacity duration-200 ${isDimmed ? "opacity-40" : "opacity-100"}`}
                  onMouseEnter={() => setHoveredSegment(segment)}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[segment.label] }}
                    />
                    <span className={`font-medium text-[var(--color-muted)] ${isHovered ? "text-[var(--color-fg)]" : ""}`}>
                      {segment.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums text-[var(--color-fg)]">
                      {formatCurrency(segment.amount)}
                    </span>
                    <span className="font-medium font-mono text-[10px] text-[var(--color-muted)]">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
