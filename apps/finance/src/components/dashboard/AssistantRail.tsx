"use client";

import { useState } from "react";
import Link from "next/link";
import { FEED_ITEMS, type FeedItem } from "../today/mockData";

/**
 * The assistant's column on the dashboard. Quiet by design: a status
 * line, decision cards only when something actually needs the user,
 * and a link into the full activity trail at /today. Conversational
 * entry stays with the global bottom agent input — this rail never
 * grows filler widgets to look busy.
 *
 * Decisions come from the same hardcoded mock data as the Today feed;
 * approve/skip state is local-only until a real agent feeds this.
 */

type DecisionState = "open" | "approved" | "skipped";

const MAX_VISIBLE = 3;

function DecisionCard({
  item,
  approved,
  onApprove,
  onSkip,
}: {
  item: FeedItem;
  approved: boolean;
  onApprove: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="relative pl-4">
      <div
        className={`absolute left-0 top-1 bottom-1 w-1 rounded-full ${
          approved ? "bg-emerald-500" : "bg-amber-500"
        }`}
      />

      <div className="flex items-baseline gap-2 text-[11px] text-[var(--color-muted)]">
        <span className="font-medium uppercase tracking-wider">{item.category}</span>
        <span>·</span>
        <span>{item.when}</span>
      </div>

      <div className="mt-1.5 text-sm font-medium text-[var(--color-fg)]">
        {item.headline}
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{item.body}</p>

      {!approved ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onApprove}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            {item.action}
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Skip
          </button>
          <Link
            href="/today"
            className="ml-auto text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Why ›
          </Link>
        </div>
      ) : (
        item.confirmation && (
          <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-500">
            {item.confirmation}
          </p>
        )
      )}
    </div>
  );
}

export default function AssistantRail() {
  const [states, setStates] = useState<Record<string, DecisionState>>({});

  const decisions = FEED_ITEMS.filter(
    (item) => item.tone === "decision" && states[item.id] !== "skipped",
  );
  const openCount = decisions.filter((d) => states[d.id] !== "approved").length;
  const visible = decisions.slice(0, MAX_VISIBLE);
  const overflow = decisions.length - visible.length;

  const setItem = (id: string, state: DecisionState) =>
    setStates((s) => ({ ...s, [id]: state }));

  return (
    <div>
      <div className="card-header mb-4">Assistant</div>

      <p className="text-sm text-[var(--color-muted)]">
        {openCount === 0 ? (
          <>
            <span className="text-emerald-600 dark:text-emerald-500">✓</span>{" "}
            Checked 142 transactions across 6 accounts this week — nothing
            needs you.
          </>
        ) : (
          <>
            Reviewed this week&apos;s activity.{" "}
            <span className="font-medium text-[var(--color-fg)]">
              {openCount} {openCount === 1 ? "thing needs" : "things need"} you.
            </span>
          </>
        )}
      </p>

      {visible.length > 0 && (
        <div className="mt-6 space-y-6">
          {visible.map((item) => (
            <DecisionCard
              key={item.id}
              item={item}
              approved={states[item.id] === "approved"}
              onApprove={() => setItem(item.id, "approved")}
              onSkip={() => setItem(item.id, "skipped")}
            />
          ))}
        </div>
      )}

      {overflow > 0 && (
        <Link
          href="/today"
          className="mt-4 inline-block text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          {overflow} more ›
        </Link>
      )}

      <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
        <Link
          href="/today"
          className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
        >
          Recent activity ›
        </Link>
      </div>
    </div>
  );
}
