"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// Pseudo-random offset pattern keyed by index. Deterministic so the
// purity rule stays happy (no Math.random in render) while still
// reading as scattered/organic when items animate in.
const OFFSET_PATTERN: { x: number; y: number }[] = [
  { x: -18, y: -4 },
  { x: 22, y: 8 },
  { x: -10, y: 14 },
  { x: 24, y: -6 },
  { x: -22, y: 2 },
  { x: 14, y: -12 },
  { x: -6, y: 16 },
  { x: 26, y: 0 },
];

/**
 * Stagger-in wrapper for widget rows. Each child flies in from a small
 * offset (cycled deterministically) and settles with an exponential-out
 * ease — feels like assembly, not a list rendering.
 *
 * Caps the per-item delay so very long lists still finish appearing
 * within ~0.6s of the first item.
 */
export function MagicItem({
  index,
  children,
  className,
}: {
  index: number;
  children: ReactNode;
  className?: string;
}) {
  const offset = OFFSET_PATTERN[index % OFFSET_PATTERN.length];
  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        // Cap stagger delay so long lists don't take forever to assemble.
        delay: Math.min(index * 0.04, 0.4),
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Quiet section label used at the top of widgets. No card, no border —
 * just a tiny uppercase line that anchors the data block visually.
 */
export function WidgetLabel({
  left,
  right,
}: {
  left: ReactNode;
  right?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex items-baseline justify-between gap-3 mb-3"
    >
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)]">
        {left}
      </span>
      {right ? (
        <span className="text-[10px] tracking-wide text-[var(--color-muted)] tabular-nums">
          {right}
        </span>
      ) : null}
    </motion.div>
  );
}

/**
 * Outer wrapper for a widget — no chrome, just spacing and a soft fade
 * for the whole block on first render. Each child should be a section
 * (label + items).
 */
export function WidgetFrame({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="my-5"
    >
      {children}
    </motion.div>
  );
}

/**
 * A subtle inline error pill for tool results that came back with an
 * `error` field. Keeps the same chromeless style.
 */
export function WidgetError({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="my-5 text-xs text-[var(--color-danger)]"
    >
      Couldn&apos;t load: {message}
    </motion.div>
  );
}
