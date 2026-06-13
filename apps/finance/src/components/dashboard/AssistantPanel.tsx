"use client";

import Link from "next/link";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The dashboard's right column, dedicated to the assistant. Clean and
 * sparse by design: a status line, headline-only decision rows, and a
 * muted pulse of recently handled work — everything links into /today,
 * where the evidence and approve/skip live. No buttons, no body copy;
 * the column tells you what exists, the activity view is where you act.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */
export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");
  const stakes = decisions.reduce((sum, d) => sum + (d.stakes ?? 0), 0);

  return (
    <div>
      <div className="card-header mb-6">Assistant</div>

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
          {stakes > 0 && (
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              ~${(Math.round(stakes / 50) * 50).toLocaleString()}/yr on the table
            </p>
          )}

          <div className="mt-5 space-y-1">
            {decisions.map((item) => (
              <Link
                key={item.id}
                href="/today"
                className="group flex items-start gap-3 -mx-2 px-2 py-3 rounded-lg hover:bg-[var(--color-surface-alt)]/40 transition-colors"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[var(--color-fg)] leading-snug">
                    {item.headline}
                  </span>
                  {item.stakes && (
                    <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
                      Worth ~${item.stakes.toLocaleString()}/yr
                    </span>
                  )}
                </span>
                <span className="mt-0.5 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
                  ›
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {handled.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
          <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
            Handled for you
          </div>
          <div className="space-y-3">
            {handled.map((item) => (
              <Link
                key={item.id}
                href="/today"
                className="group flex items-start gap-3"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-[var(--color-muted)] group-hover:text-[var(--color-fg)] leading-snug transition-colors">
                  {item.headline}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <Link
          href="/today"
          className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          All activity ›
        </Link>
      </div>
    </div>
  );
}
