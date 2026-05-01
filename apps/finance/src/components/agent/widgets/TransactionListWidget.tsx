"use client";

import { useState } from "react";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame, WidgetLabel } from "./primitives";

type Transaction = {
  id: string;
  date: string | null;
  description: string;
  merchant_name: string | null;
  amount: number;
  category: string;
  category_color: string;
  account_name: string;
  icon_url: string | null;
};

export type TransactionListData = {
  transactions: Transaction[];
  count: number;
  days_searched?: number;
  merchant_query?: string | null;
  error?: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TransactionListWidget({ data }: { data: TransactionListData }) {
  if (data.error) return <WidgetError message={data.error} />;

  const labelParts: string[] = [];
  if (data.merchant_query) labelParts.push(`"${data.merchant_query}"`);
  labelParts.push(`Last ${data.days_searched ?? 30} days`);
  const left = labelParts.join(" · ");
  const right = `${data.count} ${data.count === 1 ? "match" : "matches"}`;

  return (
    <WidgetFrame>
      <WidgetLabel left={left} right={right} />
      {data.transactions.length === 0 ? (
        <div className="text-xs text-[var(--color-muted)]">No transactions match.</div>
      ) : (
        <div className="space-y-1">
          {data.transactions.map((tx, i) => (
            <MagicItem key={tx.id} index={i}>
              <TransactionRow tx={tx} />
            </MagicItem>
          ))}
        </div>
      )}
    </WidgetFrame>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 group">
      <div className="flex items-center gap-3 min-w-0">
        <MerchantIcon
          iconUrl={tx.icon_url}
          name={tx.merchant_name || tx.description}
          color={tx.category_color}
        />
        <div className="min-w-0">
          <div className="text-sm text-[var(--color-fg)] truncate">
            {tx.merchant_name || tx.description}
          </div>
          <div className="text-[11px] text-[var(--color-muted)] truncate">
            {formatDate(tx.date)} · {tx.category}
          </div>
        </div>
      </div>
      <div
        className={`text-sm tabular-nums flex-shrink-0 ${
          tx.amount < 0 ? "text-emerald-500" : "text-[var(--color-fg)]"
        }`}
      >
        {tx.amount < 0 ? "+" : ""}
        {formatCurrency(Math.abs(tx.amount))}
      </div>
    </div>
  );
}

function MerchantIcon({
  iconUrl,
  name,
  color,
}: {
  iconUrl: string | null;
  name: string;
  color: string;
}) {
  // Track image load failure so we can fall back gracefully without
  // calling the `onError` repeatedly. Plaid's icon URLs are reliable
  // but occasionally 404 for niche merchants.
  const [imageFailed, setImageFailed] = useState(false);

  if (iconUrl && !imageFailed) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="w-7 h-7 rounded-full bg-[var(--color-surface-alt)] flex-shrink-0 object-cover"
      />
    );
  }

  // Fallback: a small filled circle with the merchant initial. Color
  // borrows the category's color for a subtle hint at category type.
  const initial = (name || "·").trim().charAt(0).toUpperCase();
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-medium text-white flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  );
}
