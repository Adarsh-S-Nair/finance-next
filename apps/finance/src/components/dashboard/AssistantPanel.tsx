"use client";

import Link from "next/link";
import { FEED_ITEMS, HANDLED_ITEMS, type FeedSeverity } from "../today/mockData";

/**
 * The dashboard's assistant card. One cohesive list — no nested cards,
 * no icons. Each thing the assistant surfaces is a row led by a thin
 * severity-colored rule (red = action, amber = worth a look, green =
 * just so you know), with the headline, a colored status word, and its
 * value. The handled work uses the same row rhythm below a divider so
 * it reads as part of the same list, not an afterthought. The whole
 * row taps through to /today.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */

const SEVERITY: Record<FeedSeverity, { label: string; color: string }> = {
  action: { label: "Action recommended", color: "var(--color-danger)" },
  review: { label: "Worth reviewing", color: "var(--color-warn)" },
  info: { label: "No action needed", color: "var(--color-success)" },
};

export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");

  return (
    <div className="w-full bg-[var(--color-surface-alt)] p-5">
      <div className="flex items-baseline justify-between">
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
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          <span className="text-[var(--color-success)]">✓</span> Nothing needs you right now.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-[var(--color-border)]">
          {decisions.map((item) => {
            const sev = SEVERITY[item.severity ?? "review"];
            const value = item.stakes ? `$${item.stakes.toLocaleString()}/yr` : null;
            return (
              <Link key={item.id} href="/today" className="group relative flex items-start gap-2 py-3.5">
                <span
                  aria-hidden
                  className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
                  style={{ background: sev.color }}
                />
                <div className="min-w-0 flex-1 pl-3.5">
                  <p className="text-[13px] font-medium leading-snug text-[var(--color-fg)]">
                    {item.headline}
                  </p>
                  <p className="mt-1 text-[11px]">
                    <span className="font-medium" style={{ color: sev.color }}>
                      {sev.label}
                    </span>
                    {value && <span className="text-[var(--color-muted)]"> · {value}</span>}
                  </p>
                </div>
                <span className="self-center text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                  ›
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {HANDLED_ITEMS.length > 0 && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <span className="card-header">Handled for you</span>
          <div className="mt-1 divide-y divide-[var(--color-border)]">
            {HANDLED_ITEMS.map((item) => (
              <Link
                key={item.id}
                href="/today"
                className="group flex items-baseline justify-between gap-3 py-2.5 pl-3.5"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-fg)]">
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
