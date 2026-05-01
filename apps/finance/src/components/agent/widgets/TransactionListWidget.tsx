"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiTag, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import {
  MagicItem,
  WidgetError,
  WidgetFrame,
  AnimateProvider,
} from "./primitives";

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
  // Track which way the user is paging so the entrance/exit animations
  // can match: clicking next slides the new page in from the right,
  // clicking prev slides it in from the left. Initial mount uses 0
  // (no slide; the per-row stagger handles entrance).
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);

  if (data.error) return <WidgetError message={data.error} />;

  const total = data.transactions.length;
  const totalPages = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, total);
  const visible = data.transactions.slice(start, end);

  function handlePageChange(next: number) {
    setDirection(next > safePage ? 1 : -1);
    setPage(next);
  }

  return (
    <WidgetFrame>
      {total === 0 ? (
        <div className="text-xs text-[var(--color-muted)]">No transactions match.</div>
      ) : (
        <>
          <PaginatedRows
            visible={visible}
            page={safePage}
            direction={direction}
          />
          {totalPages > 1 && (
            <PaginationFooter
              page={safePage}
              totalPages={totalPages}
              start={start + 1}
              end={end}
              total={total}
              onChange={handlePageChange}
            />
          )}
        </>
      )}
    </WidgetFrame>
  );
}

/**
 * Two animation modes share this list:
 *
 * - First render (direction === 0): inherit the parent's animate
 *   context (MagicItem's scattered stagger plays for fresh messages,
 *   nothing for history). This preserves the "magical entrance" the
 *   widget had before pagination existed.
 *
 * - Pagination (direction !== 0): swap the whole page out with a
 *   directional slide+blur, in via AnimatePresence keyed on `page`.
 *   Per-row MagicItem animations are suppressed during a page swap
 *   (we wrap the new page in AnimateProvider value=false) so the
 *   slide reads as one cohesive motion instead of double-animating.
 */
function PaginatedRows({
  visible,
  page,
  direction,
}: {
  visible: Transaction[];
  page: number;
  direction: -1 | 0 | 1;
}) {
  // First-render path: no AnimatePresence wrapper, no slide. Lets the
  // parent's MagicItem stagger play unchanged.
  if (direction === 0) {
    return (
      <div>
        {visible.map((tx, i) => (
          <MagicItem key={tx.id} index={i}>
            <TransactionRow tx={tx} />
          </MagicItem>
        ))}
      </div>
    );
  }

  // Paging path: animated swap. mode="popLayout" lets the outgoing and
  // incoming pages overlap for a moment so the slide reads as movement
  // rather than a wipe. The slide distance is small (12px) — the goal
  // is "this list shifted" not "this list flew across".
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={page}
        initial={{ opacity: 0, x: direction * 16, filter: "blur(3px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, x: -direction * 16, filter: "blur(3px)" }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Suppress per-row stagger during page swaps — the page-level
            slide already carries the motion. Otherwise rows would
            animate-in twice (slide + scattered stagger), which feels
            busy and slightly disorients the eye. */}
        <AnimateProvider animate={false}>
          {visible.map((tx, i) => (
            <ChildRowWithDelay key={tx.id} tx={tx} index={i} />
          ))}
        </AnimateProvider>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Per-row motion inside a paginated swap. Rows get a small staggered
 * fade-up on top of the page-level slide, so the page reads as
 * "assembling" rather than a flat slab. The MagicItem blur+scatter is
 * deliberately off here — it would compound with the slide and feel
 * busy. We're inside an AnimateProvider value={false} parent, so
 * MagicItem itself wouldn't animate even if we used it.
 */
function ChildRowWithDelay({ tx, index }: { tx: Transaction; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: "easeOut" }}
    >
      <TransactionRow tx={tx} />
    </motion.div>
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
