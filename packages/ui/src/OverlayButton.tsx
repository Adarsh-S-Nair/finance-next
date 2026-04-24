"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "danger" | "secondary";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> & {
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
};

/**
 * Pill-shaped action button used across every overlay modal (sign-out
 * confirm, household invite, switcher create/join). Primary is the fg
 * fill on bg text; danger fills with the danger color; secondary is the
 * outlined sibling for when a dialog needs two buttons of comparable
 * weight (e.g. "Cancel this" / "Confirm this"). Loading state swaps the
 * label for a spinner and makes the button non-interactive.
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
        "inline-flex h-9 min-w-[7rem] items-center justify-center gap-1.5 rounded-full px-5 text-sm font-medium transition-[opacity,background-color,border-color,color] cursor-pointer",
        variant === "danger" && "bg-[var(--color-danger)] text-white",
        variant === "primary" && "bg-[var(--color-fg)] text-[var(--color-bg)]",
        variant === "secondary" &&
          "bg-transparent text-[var(--color-fg)] ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-fg)]",
        variant !== "secondary" && !isInactive && "hover:opacity-90",
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
