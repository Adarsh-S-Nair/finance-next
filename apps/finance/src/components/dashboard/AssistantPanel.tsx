"use client";

import Link from "next/link";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The top of the dashboard's right column — the assistant's slot,
 * styled as a filled card (same surface treatment as UpgradeBanner):
 * hero stat for the total annual value of the open decisions,
 * divider-separated headline rows with right-aligned values, and one
 * full-width CTA into /today, where the evidence and approve/skip
 * live. The quieter "handled" pulse sits below the card, outside the
 * fill, so the card stays punchy and the history stays ambient.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */
export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");
  const stakes = decisions.reduce((sum, d) => sum + (d.stakes ?? 0), 0);
  const stakesRounded = Math.round(stakes / 50) * 50;

  return (
    <div>
      <div className="w-full bg-[var(--color-surface-alt)] p-5">
        <span className="card-header">Assistant</span>

        {decisions.length === 0 ? (
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            All clear — nothing needs you right now. Anything worth your
            attention will show up here.
          </p>
        ) : (
          <>
            <div className="mt-3 text-3xl font-medium tracking-tight tabular-nums text-[var(--color-fg)]">
              ~${stakesRounded.toLocaleString()}
            </div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              left on the table this year
            </p>

            <div className="mt-4 divide-y divide-[var(--color-border)]">
              {decisions.map((item) => (
                <Link
                  key={item.id}
                  href="/today"
                  className="group flex items-baseline gap-3 py-2.5"
                >
                  <span className="flex-1 min-w-0 text-[13px] leading-snug text-[var(--color-fg)]/85 group-hover:text-[var(--color-fg)] line-clamp-2 transition-colors">
                    {item.headline}
                  </span>
                  {item.stakes && (
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
                      ${item.stakes.toLocaleString()}/yr
                    </span>
                  )}
                </Link>
              ))}
            </div>

            <Link
              href="/today"
              className="mt-4 inline-flex w-full h-9 items-center justify-center rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Review {decisions.length}{" "}
              {decisions.length === 1 ? "decision" : "decisions"}
            </Link>
          </>
        )}
      </div>

      {handled.length > 0 && (
        <div className="mt-8">
          <div className="text-[11px] font-medium text-[var(--color-muted)] uppercase tracking-wider mb-3">
            Handled for you
          </div>
          <div className="space-y-3">
            {handled.map((item) => (
              <Link
                key={item.id}
                href="/today"
                className="group flex items-baseline gap-3"
              >
                <span className="flex-1 min-w-0 text-sm text-[var(--color-muted)] group-hover:text-[var(--color-fg)] leading-snug transition-colors">
                  {item.headline}
                </span>
                <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                  {item.when}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
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
