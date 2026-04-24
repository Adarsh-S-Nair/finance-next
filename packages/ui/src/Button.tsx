"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?:
    | "primary"
    | "accent"
    | "secondary"
    | "ghost"
    | "danger"
    | "dangerSubtle"
    | "outline"
    | "glass"
    | "matte"
    | "minimal";
  size?: "sm" | "md" | "lg" | "iconSm" | "icon" | "iconLg";
  fullWidth?: boolean;
  loading?: boolean;
};

/**
 * App-wide button. Pill-shaped, low-chrome, matches the overlay-modal
 * button language (sign-out, household invite, etc.) so every button in
 * the product looks like it's cut from the same cloth.
 *
 * - `primary` / `accent` / `glass` / `matte` all render as the filled
 *   fg-on-bg pill. They used to diverge visually; consolidating them
 *   keeps migration of existing call sites painless while delivering
 *   the same button style everywhere.
 * - `secondary` / `outline` render as the outlined pill (ring border,
 *   transparent fill) — the "comparable weight cancel" counterpart to
 *   primary.
 * - `ghost` / `minimal` stay borderless for low-chrome placements like
 *   topbar actions, but still use the pill shape so they share
 *   hover/focus behaviour with every other button.
 * - `danger` / `dangerSubtle` mirror primary / ghost but swap in the
 *   danger color.
 *
 * Icon-only sizes (`iconSm`, `icon`, `iconLg`) set an explicit width so
 * they render as true circles rather than as wide pills.
 */
const base =
  "inline-flex select-none items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-[opacity,background-color,color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-fg)]/30 disabled:opacity-50 disabled:pointer-events-none cursor-pointer";

const variants: Record<string, string> = {
  primary:
    "bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90",
  accent:
    "bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90",
  glass:
    "bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90",
  matte:
    "bg-[var(--color-fg)] text-[var(--color-bg)] hover:opacity-90",
  secondary:
    "bg-transparent text-[var(--color-fg)] ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-fg)]",
  outline:
    "bg-transparent text-[var(--color-fg)] ring-1 ring-inset ring-[var(--color-border)] hover:ring-[var(--color-fg)]",
  ghost:
    "bg-transparent text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]",
  minimal:
    "bg-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)]/60",
  danger:
    "bg-[var(--color-danger)] text-white hover:opacity-90",
  dangerSubtle:
    "bg-transparent text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_92%)]",
};

// Text-size classes include a minimum width so short labels ("Cancel",
// "Confirm") don't render as pinched little pills. Icon sizes use an
// explicit width so the pill renders as a circle.
const textSizes: Record<string, string> = {
  sm: "h-8 px-4 min-w-[5.5rem]",
  md: "h-9 px-5 min-w-[7rem]",
  lg: "h-11 px-6 min-w-[8rem]",
};

const iconSizes: Record<string, string> = {
  iconSm: "h-8 w-8",
  icon: "h-9 w-9",
  iconLg: "h-11 w-11",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      fullWidth = false,
      loading = false,
      children,
      ...props
    },
    ref,
  ) => {
    const sizeClass = iconSizes[size] ?? textSizes[size] ?? textSizes.md;

    return (
      <button
        ref={ref}
        className={clsx(
          base,
          variants[variant],
          sizeClass,
          fullWidth && "w-full",
          className,
        )}
        disabled={loading || props.disabled}
        aria-busy={loading || undefined}
        {...props}
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
  },
);

Button.displayName = "Button";

export default Button;
