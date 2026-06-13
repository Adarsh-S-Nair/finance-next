"use client";

import Link from "next/link";
import { LuSparkles } from "react-icons/lu";
import { FEED_ITEMS } from "../today/mockData";

/**
 * The assistant's dashboard surface — minimalist, but with structure
 * so it doesn't read as a plain text dump. A small sparkle marks it as
 * the AI surface; the open items are a numbered briefing (index +
 * headline + meta), and character comes from the rhythm and a quiet
 * hover, not from color or glow. Monochrome except a single muted
 * accent; everything links into /today.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */
export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");
  const handled = FEED_ITEMS.filter((item) => item.tone === "handled");

  return (
    <div className="w-full rounded-xl bg-[var(--color-surface-alt)] p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LuSparkles className="h-3.5 w-3.5 text-[var(--color-fg)]" strokeWidth={2.25} />
          <span className="card-header">Assistant</span>
        </div>
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
        <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">
          All clear — nothing needs you. Anything worth a look lands here first.
        </p>
      ) : (
        <div className="mt-4 space-y-0.5">
          {decisions.map((item, i) => (
            <Link
              key={item.id}
              href="/today"
              className="group flex gap-3 -mx-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-[var(--color-fg)]/[0.035]"
            >
              <span className="w-5 shrink-0 pt-px text-[11px] font-semibold tabular-nums text-[var(--color-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium leading-snug text-[var(--color-fg)] line-clamp-2">
                  {item.headline}
                </span>
                <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
                  {item.category} · {item.when}
                </span>
              </span>
              <span className="shrink-0 self-center text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                ›
              </span>
            </Link>
          ))}
        </div>
      )}

      {handled.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3.5">
          <Link
            href="/today"
            className="text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            Handled {handled.length} {handled.length === 1 ? "thing" : "things"} on its own ›
          </Link>
        </div>
      )}
    </div>
  );
}
