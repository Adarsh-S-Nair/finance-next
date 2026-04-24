"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { FiSearch } from "react-icons/fi";
import clsx from "clsx";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  /**
   * Height preset. "md" is the default filter-picker style (py-2.5).
   * "sm" is tighter for topbar placements.
   */
  size?: "sm" | "md";
  /** Class applied to the wrapper div — use for width / margin / flex. */
  wrapperClassName?: string;
};

/**
 * The surface-alt pill search input used for the category picker in
 * the filters drawer. Standardising on it here so the transactions
 * search, the recategorise picker, and the filter's category picker
 * all look the same.
 */
const SearchInput = forwardRef<HTMLInputElement, Props>(function SearchInput(
  { className, wrapperClassName, size = "md", ...rest },
  ref,
) {
  return (
    <div className={clsx("relative", wrapperClassName)}>
      <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted)]" />
      <input
        ref={ref}
        type="text"
        {...rest}
        className={clsx(
          "w-full pl-9 pr-3 text-sm bg-[var(--color-surface-alt)] border-0 rounded-md text-[var(--color-fg)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-fg)]/20",
          size === "sm" ? "py-2" : "py-2.5",
          className,
        )}
      />
    </div>
  );
});

export default SearchInput;
