"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import clsx from "clsx";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  /**
   * Height preset. "md" is the default filter-picker style (py-2.5).
   * "sm" is tighter for topbar placements.
   */
  size?: "sm" | "md";
  /** Class applied to the wrapper div — use for width / margin / flex. */
  wrapperClassName?: string;
  /**
   * When provided, a clear "×" appears at the right edge whenever the
   * input has a value. The handler should reset the controlled value;
   * focus stays in the field so the user can type a new query.
   */
  onClear?: () => void;
};

/**
 * The surface-alt pill search input used for the category picker in
 * the filters drawer. Standardising on it here so the transactions
 * search, the recategorise picker, and the filter's category picker
 * all look the same.
 */
const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { className, wrapperClassName, size = "md", onClear, ...rest },
  ref,
) {
  const hasValue = String(rest.value ?? "").length > 0;
  const showClear = !!onClear && hasValue;
  return (
    <div className={clsx("relative", wrapperClassName)}>
      <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
      <input
        ref={ref}
        type="text"
        {...rest}
        className={clsx(
          "w-full pl-9 text-sm bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20",
          showClear ? "pr-9" : "pr-3",
          size === "sm" ? "py-2" : "py-2.5",
          className,
        )}
      />
      {showClear && (
        <button
          type="button"
          aria-label="Clear search"
          // onMouseDown instead of onClick so the press doesn't blur the
          // input first — collapsing toolbars (transactions topbar) close
          // on blur-with-empty-query, which would swallow the click.
          onMouseDown={(e) => {
            e.preventDefault();
            onClear?.();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          <FiX className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

export default SearchInput;
