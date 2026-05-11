"use client";

import { useState } from "react";
import { formatCurrency } from "../../../lib/formatCurrency";
import { formatShares } from "../../../lib/formatShares";
import { WidgetError, WidgetFrame } from "./primitives";
import { PagedList } from "./PagedList";

type Holding = {
  ticker: string;
  name: string | null;
  logo: string | null;
  shares: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_gain: number;
  unrealized_gain_pct: number;
  asset_type: string;
  sector: string | null;
  account_id: string;
  account_name: string;
  price_source: "live" | "cost_basis";
};

export type HoldingsData = {
  holdings?: Holding[];
  totals?: {
    market_value: number;
    cost_basis: number;
    unrealized_gain: number;
    unrealized_gain_pct: number;
  };
  authoritative_account_total?: number;
  uncategorized_cash_estimate?: number;
  accounts?: number;
  note?: string;
  error?: string;
};

export default function HoldingsWidget({ data }: { data: HoldingsData }) {
  if (data.error) return <WidgetError message={data.error} />;

  const holdings = data.holdings ?? [];
  if (holdings.length === 0) {
    return (
      <WidgetFrame>
        <div className="text-xs text-[var(--color-muted)]">
          {data.note ?? "No holdings to show."}
        </div>
      </WidgetFrame>
    );
  }

  // No portfolio-level headline here — total value + period delta live
  // on the performance widget, which sits directly above this one. This
  // widget is just the list.
  return (
    <WidgetFrame>
      <PagedList
        items={holdings}
        getKey={(h) => `${h.account_id}:${h.ticker}`}
        renderItem={(h) => <HoldingRow h={h} />}
        empty={
          <div className="text-xs text-[var(--color-muted)]">
            No holdings to show.
          </div>
        }
      />
    </WidgetFrame>
  );
}

function HoldingRow({ h }: { h: Holding }) {
  const subtitleParts: string[] = [`${formatShares(h.shares)} sh`];
  if (h.price_source === "cost_basis") {
    // No live quote available — flag it so the user knows the value is
    // based on what they paid, not current market.
    subtitleParts.push("at cost");
  }
  const subtitle = subtitleParts.join(" · ");

  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <div className="flex items-center gap-3 min-w-0">
        <TickerBadge ticker={h.ticker} assetType={h.asset_type} logo={h.logo} />
        <div className="min-w-0">
          <div className="text-sm text-[var(--color-fg)] truncate">
            {h.ticker}
            {h.name ? (
              <span className="text-[var(--color-muted)] font-normal"> · {h.name}</span>
            ) : null}
          </div>
          <div className="text-[11px] text-[var(--color-muted)] truncate">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end flex-shrink-0">
        <div className="text-sm tabular-nums text-[var(--color-fg)]">
          {formatCurrency(h.market_value, true)}
        </div>
        <GainText amount={h.unrealized_gain} pct={h.unrealized_gain_pct} />
      </div>
    </div>
  );
}

function TickerBadge({
  ticker,
  assetType,
  logo,
}: {
  ticker: string;
  assetType: string;
  logo: string | null;
}) {
  // Logo URLs come from the `tickers` table. They can be hosted URLs or
  // data: URIs; either works as an <img src>. Track failure so a broken
  // URL falls back to the text badge instead of showing a broken
  // image glyph.
  const [imageFailed, setImageFailed] = useState(false);
  const isCash = assetType.toLowerCase() === "cash";
  const display = isCash ? "$" : ticker.slice(0, 3).toUpperCase();

  if (logo && !imageFailed) {
    return (
      <img
        src={logo}
        alt={ticker}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] flex-shrink-0 object-cover"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-alt)] flex-shrink-0">
      <span className="text-[10px] font-semibold text-[var(--color-muted)]">
        {display}
      </span>
    </div>
  );
}

function GainText({ amount, pct }: { amount: number; pct: number }) {
  // Per-row variant: smaller, no parens around the dollar amount, just
  // the percentage with a sign. Keeps the row compact on narrow widths.
  if (amount === 0 && pct === 0) return null;
  const positive = amount >= 0;
  const color = positive
    ? "text-[var(--color-success)]"
    : "text-[var(--color-danger)]";
  const sign = positive ? "+" : "";
  return (
    <span className={`text-[11px] tabular-nums ${color}`}>
      {sign}
      {pct.toFixed(1)}%
    </span>
  );
}
