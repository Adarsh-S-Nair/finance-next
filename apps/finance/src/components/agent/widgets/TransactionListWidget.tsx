"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";

type Transaction = {
  id: string;
  date: string | null;
  description: string;
  merchant_name: string | null;
  amount: number;
  category: string;
  category_color: string;
  account_name: string;
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
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TransactionListWidget({ data }: { data: TransactionListData }) {
  if (data.error) {
    return (
      <div className="my-3 px-4 py-3 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 text-xs text-[var(--color-danger)]">
        {data.error}
      </div>
    );
  }

  const labelParts: string[] = ["Transactions"];
  if (data.merchant_query) labelParts.push(`"${data.merchant_query}"`);
  if (data.days_searched) labelParts.push(`last ${data.days_searched}d`);
  const label = labelParts.join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="my-3 rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-content-bg)] overflow-hidden"
    >
      <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-border)]/30 bg-[var(--color-surface-alt)]/30 flex items-center justify-between">
        <span>{label}</span>
        <span className="text-[10px] normal-case tracking-normal text-[var(--color-muted)]/70">
          {data.count} {data.count === 1 ? "match" : "matches"}
        </span>
      </div>

      {data.transactions.length === 0 ? (
        <div className="px-4 py-6 text-xs text-[var(--color-muted)] text-center">
          No transactions match.
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]/40">
          {data.transactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.025, 0.4), duration: 0.2 }}
              className="px-4 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tx.category_color }}
                  aria-hidden
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
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
