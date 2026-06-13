"use client";

import { useState } from "react";
import PageContainer from "../layout/PageContainer";
import {
  AUTONOMY_RULES,
  FEED_ITEMS,
  REVIEWED_SUMMARY,
  type AutonomyRule,
  type FeedItem,
} from "./mockData";

/**
 * Mockup of the agent "Today" feed — the proposed primary surface for the
 * personal finance agent. Hardcoded data, local-only interactions; the
 * point is to feel out the card anatomy, tone colors, and approve/skip
 * loop before wiring a real agent behind it.
 */

type ItemState = "open" | "approved" | "skipped";

const TONE_BAR: Record<string, string> = {
  handled: "bg-emerald-500",
  decision: "bg-amber-500",
  approved: "bg-emerald-500",
};

function FeedCard({
  item,
  state,
  onApprove,
  onSkip,
}: {
  item: FeedItem;
  state: ItemState;
  onApprove: () => void;
  onSkip: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const approved = state === "approved";
  const bar = TONE_BAR[approved ? "approved" : item.tone];

  return (
    <div className="relative pl-4">
      <div className={`absolute left-0 top-1 bottom-1 w-1 rounded-full ${bar}`} />

      <div className="flex items-baseline gap-2 text-[11px] text-[var(--color-muted)]">
        <span className="font-medium uppercase tracking-wider">{item.category}</span>
        <span>·</span>
        <span>{item.when}</span>
      </div>

      <div className="mt-1.5 text-sm font-medium text-[var(--color-fg)]">
        {item.headline}
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)] max-w-2xl">{item.body}</p>

      {item.evidence && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            {expanded ? "Hide the details ‹" : "See why ›"}
          </button>
          {expanded && (
            <div className="mt-2 max-w-2xl divide-y divide-[var(--color-border)]">
              {item.evidence.map((row, i) => (
                <div key={i} className="flex items-baseline gap-3 py-2 text-xs">
                  <span className="w-16 shrink-0 font-medium tabular-nums text-[var(--color-fg)]">
                    {row.label}
                  </span>
                  <span className="flex-1 text-[var(--color-muted)]">{row.detail}</span>
                  {row.amount && (
                    <span className="tabular-nums text-[var(--color-fg)]">{row.amount}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {item.tone === "decision" && !approved && (
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={onApprove}
            className="px-3.5 py-2 rounded-md text-xs font-medium bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] transition-colors"
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
        </div>
      )}

      {approved && item.confirmation && (
        <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-500 max-w-2xl">
          {item.confirmation}
        </p>
      )}
    </div>
  );
}

function AutonomyRow({ rule }: { rule: AutonomyRule }) {
  const [mode, setMode] = useState(rule.mode);
  const cycle = () =>
    setMode((m) => (m === "Auto" ? "Ask first" : m === "Ask first" ? "Never" : "Auto"));

  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <span className="text-sm text-[var(--color-fg)]">{rule.action}</span>
        {rule.note && (
          <span className="ml-2 text-[11px] text-[var(--color-muted)]">{rule.note}</span>
        )}
      </div>
      <button
        type="button"
        onClick={cycle}
        className={`text-xs font-medium transition-colors ${
          mode === "Auto"
            ? "text-emerald-600 dark:text-emerald-500"
            : mode === "Never"
              ? "text-[var(--color-muted)]"
              : "text-[var(--color-fg)]"
        } hover:opacity-70`}
      >
        {mode}
      </button>
    </div>
  );
}

export default function TodayView() {
  const [states, setStates] = useState<Record<string, ItemState>>({});

  const setItem = (id: string, state: ItemState) =>
    setStates((s) => ({ ...s, [id]: state }));

  const visible = FEED_ITEMS.filter((item) => states[item.id] !== "skipped");
  const decisionsLeft = visible.filter(
    (item) => item.tone === "decision" && states[item.id] !== "approved",
  ).length;
  const handledCount = visible.length - decisionsLeft;

  return (
    <PageContainer>
      <div className="max-w-3xl">
        <div className="mb-10">
          <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
            Activity
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Everything the assistant handled or flagged ·{" "}
            {handledCount} handled ·{" "}
            {decisionsLeft === 0
              ? "nothing needs you"
              : `${decisionsLeft} need${decisionsLeft === 1 ? "s" : ""} you`}
          </p>
        </div>

        <div className="space-y-10">
          {visible.map((item) => (
            <FeedCard
              key={item.id}
              item={item}
              state={states[item.id] ?? "open"}
              onApprove={() => setItem(item.id, "approved")}
              onSkip={() => setItem(item.id, "skipped")}
            />
          ))}
        </div>

        <p className="mt-12 text-xs text-[var(--color-muted)]">{REVIEWED_SUMMARY}</p>

        <div className="mt-14">
          <div className="flex items-center justify-between mb-2">
            <div className="card-header">Autonomy</div>
          </div>
          <p className="text-xs text-[var(--color-muted)] mb-3 max-w-2xl">
            What the agent may do on its own. It earns Auto one action type at a
            time, and you can take any of them back here.
          </p>
          <div className="divide-y divide-[var(--color-border)]">
            {AUTONOMY_RULES.map((rule) => (
              <AutonomyRow key={rule.id} rule={rule} />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
