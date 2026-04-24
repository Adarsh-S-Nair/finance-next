"use client";

import Link from "next/link";
import clsx from "clsx";

type ViewAllLinkProps = {
  href?: string;
  onClick?: () => void;
  /**
   * Optional override. Default is a single chevron glyph — the dashboard
   * cards used to all say "View all" in the top-right corner, which read
   * as visual clutter; a quiet chevron is enough to signal "tap to see
   * more" without competing with the card title.
   */
  children?: React.ReactNode;
  className?: string;
  /** Accessible label for icon-only usage. Falls back to "View all". */
  ariaLabel?: string;
};

export default function ViewAllLink({
  href,
  onClick,
  children,
  className,
  ariaLabel,
}: ViewAllLinkProps) {
  const styles = clsx(
    // Compact tap target so the icon doesn't drift off-axis from the card
    // title; -mr-1 pulls it flush to the right edge of the card padding.
    "group inline-flex items-center justify-center h-6 w-6 -mr-1 rounded-full",
    "text-[var(--color-muted)] hover:text-[var(--color-fg)]",
    "transition-colors cursor-pointer",
    className
  );

  // Default content: a chevron that nudges right on hover. Using a span
  // (not a heavier SVG) keeps the visual weight light and matches the
  // chevron treatment used elsewhere in the app (transactions row,
  // settings rows, etc.).
  const content =
    children ?? (
      <span
        aria-hidden
        className="text-base leading-none transition-transform duration-200 ease-out group-hover:translate-x-0.5"
      >
        &#8250;
      </span>
    );

  const label = ariaLabel ?? (typeof children === "string" ? children : "View all");

  if (href) {
    return (
      <Link href={href} className={styles} aria-label={label}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={styles} aria-label={label} type="button">
      {content}
    </button>
  );
}
