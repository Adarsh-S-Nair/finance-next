"use client";

import Link from "next/link";
import clsx from "clsx";

type ViewAllLinkProps = {
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
};

export default function ViewAllLink({ href, onClick, children = "View all", className }: ViewAllLinkProps) {
  const styles = clsx(
    "text-xs text-[var(--color-fg)]/50 hover:text-[var(--color-fg)] transition-colors cursor-pointer",
    className
  );

  if (href) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={styles}>
      {children}
    </button>
  );
}
