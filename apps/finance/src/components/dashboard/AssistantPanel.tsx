"use client";

import Link from "next/link";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The dashboard's assistant column — the original compact "signal"
 * design: a status line, headline rows marked with a small amber dot
 * and their per-item value, then a muted pulse of recently handled
 * work. No buttons, no body copy, no card fill — the column tells you
 * what exists and the row taps through to /today, where the evidence
 * and approve/skip live.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */
export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <span className="card-header">Assistant</span>
        {decisions.length > 0 && (
          <Link
            href="/today"
            className="text-[11px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            {decisions.length} to review
          </Link>
        )}
      </div>

      {decisions.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          <span className="text-emerald-600 dark:text-emerald-500">✓</span>{" "}
          Nothing needs you right now.
        </p>
      ) : (
        <>
          <p className="text-sm text-[var(--color-fg)]">
            {decisions.length} {decisions.length === 1 ? "thing needs" : "things need"} you
          </p>

          <div className="mt-4 space-y-1">
            {decisions.map((item) => (
              <Link
                key={item.id}
                href="/today"
                className="group flex items-start gap-3 -mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--color-surface-alt)]/50"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span className="min-w-0 flex-1 text-sm leading-snug text-[var(--color-fg)]">
                  {item.headline}
                </span>
                {item.stakes && (
                  <span className="mt-0.5 shrink-0 text-[11px] tabular-nums text-[var(--color-muted)]">
                    ${item.stakes.toLocaleString()}/yr
                  </span>
                )}
              </Link>
            ))}
          </div>
        </>
      )}

      {handled.length > 0 && (
        <div className="mt-8 border-t border-[var(--color-border)] pt-6">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Handled for you
          </div>
          <div className="space-y-3">
            {handled.map((item) => (
              <Link key={item.id} href="/today" className="group flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-fg)]">
                  {item.headline}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--color-muted)]">{item.when}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
