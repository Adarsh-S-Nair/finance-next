"use client";

import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame } from "./primitives";

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
  if (data.error) return <WidgetError message={data.error} />;

  // Group accounts by category, preserving the global order.
  const grouped = new Map<Account["category"], Account[]>();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const acc of data.accounts) grouped.get(acc.category)?.push(acc);

  // Track a running global index so the magic stagger flows across all
  // categories rather than restarting at 0 in each section.
  let runningIndex = 0;

  return (
    <WidgetFrame>
      {data.accounts.length === 0 ? (
        <div className="text-xs text-[var(--color-muted)]">No accounts connected.</div>
      ) : (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;

            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  <span
                    className="w-1 h-1 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLOR[cat] }}
                    aria-hidden
                  />
                  {CATEGORY_LABEL[cat]}
                </div>
                <div className="space-y-2">
                  {items.map((acc) => {
                    const idx = runningIndex++;
                    return (
                      <MagicItem key={acc.id} index={idx}>
                        <div className="flex items-center justify-between gap-3">
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
                        </div>
                      </MagicItem>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetFrame>
  );
}
