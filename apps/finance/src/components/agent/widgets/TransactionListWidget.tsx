"use client";

import { useState } from "react";
import { FiTag, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import { MagicItem, WidgetError, WidgetFrame } from "./primitives";

// Cap visible rows so a "show me 30 transactions" call doesn't paint a
// wall of items in the chat. The user can flip pages to see more — same
// data, much less vertical real estate.
const ITEMS_PER_PAGE = 5;

type Transaction = {
  id: string;
  date: string | null;
  description: string;
  merchant_name: string | null;
  amount: number;
  category: string;
  category_color: string;
  category_icon_lib: string | null;
  category_icon_name: string | null;
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
  // Use UTC so the displayed day matches the date column's calendar day,
  // matching how TransactionRow displays it on the transactions page.
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function TransactionListWidget({ data }: { data: TransactionListData }) {
  // Page state lives here so resetting it on conversation switch (widget
  // remounts) puts the user back on page 1 — feels right.
  const [page, setPage] = useState(0);

  if (data.error) return <WidgetError message={data.error} />;

  const total = data.transactions.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  // Clamp in case the data shape changes underneath us (defensive).
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, total);
  const visible = data.transactions.slice(start, end);

  return (
    <WidgetFrame>
      {total === 0 ? (
        <div className="text-xs text-[var(--color-muted)]">No transactions match.</div>
      ) : (
        <>
          <div>
            {visible.map((tx, i) => (
              // Index by position-in-page so the magic stagger restarts
              // cleanly each page (no growing delay across pages).
              <MagicItem key={tx.id} index={i}>
                <TransactionRow tx={tx} />
              </MagicItem>
            ))}
          </div>
          {totalPages > 1 && (
            <PaginationFooter
              page={safePage}
              totalPages={totalPages}
              start={start + 1}
              end={end}
              total={total}
              onChange={setPage}
            />
          )}
        </>
      )}
    </WidgetFrame>
  );
}

function PaginationFooter({
  page,
  totalPages,
  start,
  end,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mt-3 pt-2.5 text-[11px] text-[var(--color-muted)] border-t border-[var(--color-border)]/30">
      <span className="tabular-nums">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
          className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-[var(--color-surface-alt)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <FiChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-1.5 tabular-nums">
          {page + 1} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages - 1}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
          className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-[var(--color-surface-alt)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <FiChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  // Sign convention matches the existing TransactionRow on the
  // transactions page: amount > 0 is income (emerald + leading +),
  // amount <= 0 is expense (default fg, native negative formatting).
  const isIncome = tx.amount > 0;

  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <MerchantIcon
          iconUrl={tx.icon_url}
          color={tx.category_color}
          iconLib={tx.category_icon_lib}
          iconName={tx.category_icon_name}
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
          isIncome ? "text-emerald-500" : "text-[var(--color-fg)]"
        }`}
      >
        {isIncome ? "+" : ""}
        {formatCurrency(tx.amount)}
      </div>
    </div>
  );
}

function MerchantIcon({
  iconUrl,
  color,
  iconLib,
  iconName,
}: {
  iconUrl: string | null;
  color: string;
  iconLib: string | null;
  iconName: string | null;
}) {
  // Track image load failure so we can fall back gracefully if Plaid's
  // logo URL 404s. Mirrors the pattern in TransactionRow on /transactions.
  const [imageFailed, setImageFailed] = useState(false);

  if (iconUrl && !imageFailed) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="w-7 h-7 rounded-full flex-shrink-0 object-cover bg-[var(--color-surface-alt)]"
      />
    );
  }

  // Fallback: white category icon on the category-color circle, exactly
  // like the transactions page does it (DynamicIcon + FiTag fallback).
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className="h-3.5 w-3.5 text-white"
        fallback={FiTag}
        style={{ strokeWidth: 2.5 }}
      />
    </div>
  );
}
