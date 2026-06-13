"use client";

import Link from "next/link";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The assistant's presence on the dashboard — one self-contained card
 * (everything lives inside the fill: open decisions, the handled
 * pulse, and the activity link). Designed as a digest, not a stat
 * block: a thin amber rule marks each thing that needs a decision, the
 * count in the header doubles as the link into /today, and handled
 * work trails off muted below a divider. No hero number, no big CTA —
 * the whole row is the tap target.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */
export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");

  return (
    <div className="w-full bg-[var(--color-surface-alt)] p-5">
      <div className="flex items-baseline justify-between">
        <span className="card-header">Assistant</span>
        {decisions.length > 0 && (
          <Link
            href="/today"
            className="text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            {decisions.length} to review ›
          </Link>
        )}
      </div>

      {decisions.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          All clear — nothing needs you right now. Anything worth your
          attention shows up here first.
        </p>
      ) : (
        <div className="mt-4 space-y-1">
          {decisions.map((item) => (
            <Link
              key={item.id}
              href="/today"
              className="group relative block -mx-1 py-2 pl-5 pr-1 rounded-md hover:bg-[var(--color-fg)]/[0.03] transition-colors"
            >
              <span className="absolute left-1.5 top-2.5 bottom-2.5 w-0.5 rounded-full bg-amber-500" />
              <span className="block text-[13px] font-medium leading-snug text-[var(--color-fg)] line-clamp-2">
                {item.headline}
              </span>
              <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
                {item.category} · {item.when}
              </span>
            </Link>
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--color-border)]">
          <div className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)] mb-2.5">
            Handled for you
          </div>
          <div className="space-y-2">
            {handled.map((item) => (
              <Link
                key={item.id}
                href="/today"
                className="group flex items-baseline gap-3"
              >
                <span className="flex-1 min-w-0 truncate text-xs text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
                  {item.headline}
                </span>
                <span className="shrink-0 text-[10px] text-[var(--color-muted)]">
                  {item.when}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
