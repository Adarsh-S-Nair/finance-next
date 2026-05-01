"use client";

import { motion } from "framer-motion";
import { formatCurrency } from "../../../lib/formatCurrency";

type Account = {
  id: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  category: "cash" | "credit" | "loan" | "investment" | "other";
  institution: string | null;
  current_balance: number;
  available_balance: number | null;
};

export type AccountListData = {
  accounts: Account[];
  totals: {
    total_assets: number;
    total_liabilities: number;
    net_worth: number;
  };
  error?: string;
};

const CATEGORY_ORDER: Account["category"][] = [
  "cash",
  "investment",
  "credit",
  "loan",
  "other",
];

const CATEGORY_LABEL: Record<Account["category"], string> = {
  cash: "Cash",
  investment: "Investments",
  credit: "Credit",
  loan: "Loans",
  other: "Other",
};

const CATEGORY_COLOR: Record<Account["category"], string> = {
  cash: "#059669",
  investment: "var(--color-neon-green)",
  credit: "#ef4444",
  loan: "#b91c1c",
  other: "#71717a",
};

export default function AccountListWidget({ data }: { data: AccountListData }) {
  if (data.error) {
    return (
      <div className="my-3 px-4 py-3 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 text-xs text-[var(--color-danger)]">
        {data.error}
      </div>
    );
  }

  // Group accounts by category, preserving the global order.
  const grouped = new Map<Account["category"], Account[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const acc of data.accounts) {
    grouped.get(acc.category)?.push(acc);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="my-3 rounded-xl border border-[var(--color-border)]/40 bg-[var(--color-content-bg)] overflow-hidden"
    >
      <div className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)] border-b border-[var(--color-border)]/30 bg-[var(--color-surface-alt)]/30 flex items-center justify-between">
        <span>Accounts</span>
        <span className="normal-case tracking-normal text-[var(--color-muted)]/80 tabular-nums">
          Net worth {formatCurrency(data.totals.net_worth)}
        </span>
      </div>

      {data.accounts.length === 0 ? (
        <div className="px-4 py-6 text-xs text-[var(--color-muted)] text-center">
          No accounts connected.
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]/40">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <div key={cat} className="py-1">
                <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[var(--color-muted)] flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[cat] }}
                    aria-hidden
                  />
                  {CATEGORY_LABEL[cat]}
                </div>
                {items.map((acc, i) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.025 * i, duration: 0.2 }}
                    className="px-4 py-1.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-[var(--color-fg)] truncate">
                        {acc.name}
                        {acc.mask && (
                          <span className="text-[var(--color-muted)]"> ··{acc.mask}</span>
                        )}
                      </div>
                      {acc.institution && (
                        <div className="text-[11px] text-[var(--color-muted)] truncate">
                          {acc.institution}
                        </div>
                      )}
                    </div>
                    <div className="text-sm tabular-nums text-[var(--color-fg)] flex-shrink-0">
                      {formatCurrency(acc.current_balance)}
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-2 flex items-center justify-between text-xs bg-[var(--color-surface-alt)]/30">
        <span className="text-[var(--color-muted)]">
          Assets {formatCurrency(data.totals.total_assets)} · Liabilities{" "}
          {formatCurrency(data.totals.total_liabilities)}
        </span>
      </div>
    </motion.div>
  );
}
