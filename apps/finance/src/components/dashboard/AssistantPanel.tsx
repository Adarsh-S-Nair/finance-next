"use client";

import Link from "next/link";
import { FiAlertCircle, FiTrendingUp, FiCheckCircle } from "react-icons/fi";
import type { IconType } from "react-icons";
import { FEED_ITEMS, HANDLED_ITEMS, type FeedSeverity } from "../today/mockData";

/**
 * The dashboard's assistant card. Each thing the assistant surfaces is
 * a small status card: a colored severity icon + label (Action
 * recommended / Worth reviewing / No action needed), the headline, a
 * supporting line, and an optional action. A muted "Handled for you"
 * list trails below. The whole card taps through to /today, where the
 * evidence and approve/skip live.
 *
 * Items are the same hardcoded mock data as the Today feed.
 */

const SEVERITY: Record<
  FeedSeverity,
  { label: string; color: string; icon: IconType }
> = {
  action: { label: "Action recommended", color: "var(--color-danger)", icon: FiAlertCircle },
  review: { label: "Worth reviewing", color: "var(--color-warn)", icon: FiTrendingUp },
  info: { label: "No action needed", color: "var(--color-success)", icon: FiCheckCircle },
};

export default function AssistantPanel() {
  const decisions = FEED_ITEMS.filter((item) => item.tone === "decision");

  return (
    <div className="w-full bg-[var(--color-surface-alt)] p-5">
      <div className="card-header">
        {decisions.length > 0
          ? `Zervo has ${decisions.length} ${decisions.length === 1 ? "thing" : "things"} for you`
          : "Assistant"}
      </div>

      {decisions.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          <span className="text-emerald-600 dark:text-emerald-500">✓</span> Nothing needs you right now.
        </p>
      ) : (
        <div className="mt-4 space-y-2.5">
          {decisions.map((item) => {
            const sev = SEVERITY[item.severity ?? "review"];
            const Icon = sev.icon;
            return (
              <Link
                key={item.id}
                href="/today"
                className="group block rounded-xl bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--color-surface)]/70"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in oklab, ${sev.color}, transparent 86%)` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: sev.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: sev.color }}
                    >
                      {sev.label}
                    </span>
                    <p className="mt-1 text-sm font-medium leading-snug text-[var(--color-fg)]">
                      {item.headline}
                    </p>
                    {item.meta && (
                      <p className="mt-1 text-xs text-[var(--color-muted)]">{item.meta}</p>
                    )}
                    {item.action && (
                      <span className="mt-3 inline-flex items-center rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] transition-colors group-hover:border-[var(--color-fg)]/30">
                        {item.action}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 self-center text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-fg)]">
                    ›
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {HANDLED_ITEMS.length > 0 && (
        <div className="mt-5 border-t border-[var(--color-border)] pt-4">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Handled for you
          </div>
          <div className="space-y-3">
            {HANDLED_ITEMS.map((item) => (
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
