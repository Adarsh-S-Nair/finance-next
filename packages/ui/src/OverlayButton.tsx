"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "danger";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
};

/**
 * Primary action button used across every overlay modal (sign-out confirm,
 * household invite, switcher create/join). Pill-shaped, bg-fg/text-bg in
 * primary, bg-danger/white in danger. Loading state swaps the label for a
 * spinner and makes the button non-interactive + muted.
 */
const OverlayButton = forwardRef<HTMLButtonElement, Props>(function OverlayButton(
  { loading = false, disabled = false, variant = "primary", className, children, ...rest },
  ref,
) {
  const isInactive = loading || disabled;

  return (
    <button
      ref={ref}
      type="button"
      disabled={isInactive}
      aria-busy={loading || undefined}
      className={clsx(
        "inline-flex h-9 min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition-opacity cursor-pointer",
        variant === "danger"
          ? "bg-[var(--color-danger)] text-white"
          : "bg-[var(--color-fg)] text-[var(--color-bg)]",
        !isInactive && "hover:opacity-90",
        isInactive && "opacity-50 pointer-events-none",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : (
        children
      )}
    </button>
  );
});

export default OverlayButton;
