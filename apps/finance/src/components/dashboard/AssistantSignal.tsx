"use client";

import Link from "next/link";
import { FEED_ITEMS } from "../today/mockData";

/**
 * Compact assistant presence on the dashboard — a signal, not a
 * workspace. One status line plus headline-only rows for anything that
 * needs a decision; the evidence and approve/skip live in /today. This
 * replaced the InsightsCarousel, whose job it absorbs. It must never
 * grow buttons or body copy: the dashboard tells you a decision exists,
 * the activity view is where you make it.
 *
 * Decisions are the same hardcoded mock data as the Today feed.
 */
export default function AssistantSignal() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const stakes = decisions.reduce((sum, d) => sum + (d.stakes ?? 0), 0);
  const stakesLabel =
    stakes > 0 ? `~$${(Math.round(stakes / 50) * 50).toLocaleString()}/yr on the table` : null;

  return (
    <div>
      <div className="card-header mb-4">Assistant</div>

      {decisions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          <span className="text-emerald-600 dark:text-emerald-500">✓</span>{" "}
          Nothing needs you right now.
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--color-fg)]">
            {decisions.length} {decisions.length === 1 ? "thing needs" : "things need"} you
            {stakesLabel && (
              <span className="text-[var(--color-muted)]"> · {stakesLabel}</span>
            )}
          </p>

          <div className="mt-3">
            {decisions.map((item) => (
              <Link
                key={item.id}
                href="/today"
                className="group flex items-center gap-2.5 -mx-2 px-2 py-2 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-fg)]">
                  {item.headline}
                </span>
                <span className="text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
