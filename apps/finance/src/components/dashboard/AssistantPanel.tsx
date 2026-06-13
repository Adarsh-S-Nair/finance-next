"use client";

import Link from "next/link";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The assistant's presence on the dashboard. This iteration reads as
 * the assistant talking, not a stat widget: a one-line summary in its
 * own voice, the open items as minimal text rows with a chevron, and
 * the handled work collapsed to a single trailing line. No dots, no
 * bars, no hero number, no CTA button — everything in one card, the
 * whole row is the tap target into /today.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */
export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");

  const lead =
    decisions.length === 0
      ? "I went through your week — all clear. I'll flag anything that needs you here."
      : `I went through your week. ${decisions.length} ${
          decisions.length === 1 ? "thing could use your call" : "things could use your call"
        }:`;

  return (
    <div className="w-full bg-[var(--color-surface-alt)] p-5">
      <span className="card-header">Assistant</span>

      <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg)]">{lead}</p>

      {decisions.length > 0 && (
        <div className="mt-4 space-y-px">
          {decisions.map((item) => (
            <Link
              key={item.id}
              href="/today"
              className="group flex items-center gap-3 -mx-2 px-2 py-2.5 rounded-md hover:bg-[var(--color-fg)]/[0.04] transition-colors"
            >
              <span className="flex-1 min-w-0 text-[13px] leading-snug text-[var(--color-fg)]/90 group-hover:text-[var(--color-fg)] line-clamp-2 transition-colors">
                {item.headline}
              </span>
              <span className="shrink-0 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors">
                ›
              </span>
            </Link>
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <Link
          href="/today"
          className="mt-4 block text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          I also handled {handled.length} {handled.length === 1 ? "thing" : "things"} on my own ›
        </Link>
      )}
    </div>
  );
}
