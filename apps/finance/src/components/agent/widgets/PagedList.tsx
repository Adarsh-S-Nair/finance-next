"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { AnimateProvider, MagicItem } from "./primitives";

/**
 * Generic paginated list used by widgets that surface row-shaped data
 * (transactions, holdings, anything similar). Extracted out of
 * TransactionListWidget so other lists get the same:
 *
 *   - 5-item-per-page cap with footer pagination,
 *   - first-render entrance via the parent's MagicItem stagger,
 *   - directional slide+blur for page swaps with per-row fade-up inside
 *     (animations suppressed via AnimateProvider so rows don't
 *     double-animate during a swap).
 *
 * Callers pass `renderItem` plus `getKey`; the component is otherwise
 * shape-agnostic.
 */
export interface PagedListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
  itemsPerPage?: number;
  /** Rendered when items is empty. Defaults to a quiet muted line. */
  empty?: ReactNode;
}

const DEFAULT_PER_PAGE = 5;

export function PagedList<T>({
  items,
  getKey,
  renderItem,
  itemsPerPage = DEFAULT_PER_PAGE,
  empty,
}: PagedListProps<T>) {
  // Page state lives here so resetting on conversation switch (widget
  // remounts) puts the user back on page 1 — feels right.
  const [page, setPage] = useState(0);
  // Direction tracks paging intent so the entrance/exit animations can
  // mirror it. Initial mount uses 0 (no slide; the per-row stagger
  // handles entrance).
  const [direction, setDirection] = useState<-1 | 0 | 1>(0);

  const total = items.length;
  if (total === 0) {
    return (
      <>{empty ?? <div className="text-xs text-[var(--color-muted)]">No items.</div>}</>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * itemsPerPage;
  const end = Math.min(start + itemsPerPage, total);
  const visible = items.slice(start, end);

  function handlePageChange(next: number) {
    setDirection(next > safePage ? 1 : -1);
    setPage(next);
  }

  return (
    <>
      <PaginatedRows
        visible={visible}
        page={safePage}
        direction={direction}
        getKey={getKey}
        renderItem={renderItem}
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
  );
}

function PaginatedRows<T>({
  visible,
  page,
  direction,
  getKey,
  renderItem,
}: {
  visible: T[];
  page: number;
  direction: -1 | 0 | 1;
  getKey: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  // First-render path: no AnimatePresence wrapper, no slide. Lets the
  // parent's MagicItem stagger play unchanged.
  if (direction === 0) {
    return (
      <div>
        {visible.map((item, i) => (
          <MagicItem key={getKey(item)} index={i}>
            {renderItem(item, i)}
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
            busy. */}
        <AnimateProvider animate={false}>
          {visible.map((item, i) => (
            <ChildRowWithDelay key={getKey(item)} index={i}>
              {renderItem(item, i)}
            </ChildRowWithDelay>
          ))}
        </AnimateProvider>
      </motion.div>
    </AnimatePresence>
  );
}

function ChildRowWithDelay({
  index,
  children,
}: {
  index: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25, ease: "easeOut" }}
    >
      {children}
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

export default PagedList;
