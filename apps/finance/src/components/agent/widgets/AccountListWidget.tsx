"use client";

import { useState } from "react";
import { FiCreditCard } from "react-icons/fi";
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
  institution_logo: string | null;
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

// Title-case the account subtype/type for the row subtitle. Plaid uses
// snake_case (e.g. "credit_card", "money_market"); we want "Credit Card".
function formatType(type: string | null, subtype: string | null): string {
  const raw = (subtype || type || "").trim();
  if (!raw) return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

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
        <div className="space-y-7">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped.get(cat) ?? [];
            if (items.length === 0) return null;

            return (
              <div key={cat}>
                {/* Plain section label — no colored dot. The category is
                    already implied by the accounts inside it. */}
                <div className="mb-3 text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
                  {CATEGORY_LABEL[cat]}
                </div>
                <div className="space-y-3">
                  {items.map((acc) => {
                    const idx = runningIndex++;
                    return (
                      <MagicItem key={acc.id} index={idx}>
                        <AccountRow acc={acc} />
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

function AccountRow({ acc }: { acc: Account }) {
  const subtitle = [formatType(acc.type, acc.subtype), acc.mask ? `··${acc.mask}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-3 min-w-0">
        <InstitutionIcon
          logo={acc.institution_logo}
          name={acc.institution || acc.name}
        />
        <div className="min-w-0">
          <div className="text-sm text-[var(--color-fg)] truncate">{acc.name}</div>
          {subtitle && (
            <div className="text-[11px] text-[var(--color-muted)] truncate">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div className="text-sm tabular-nums text-[var(--color-fg)] flex-shrink-0">
        {formatCurrency(acc.current_balance)}
      </div>
    </div>
  );
}

function InstitutionIcon({ logo, name }: { logo: string | null; name: string }) {
  // Plaid logos can be either data URIs (data:image/png;base64,...) or
  // hosted URLs. Either works as an <img src>. Track failure so we can
  // fall back to a generic credit-card glyph if the logo 404s.
  const [imageFailed, setImageFailed] = useState(false);

  if (logo && !imageFailed) {
    return (
      <img
        src={logo}
        alt={name}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="w-8 h-8 rounded-full bg-[var(--color-surface-alt)] flex-shrink-0 object-cover"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-alt)] flex-shrink-0">
      <FiCreditCard className="h-4 w-4 text-[var(--color-muted)]" />
    </div>
  );
}
