"use client";

import { useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "../providers/UserProvider";
import { useToast } from "../providers/ToastProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { authFetch } from "../../lib/api/fetch";
import FindingOverlay, { type OverlayFinding } from "./FindingOverlay";

/**
 * The dashboard's assistant card. Each finding is a two-line row — the
 * dollar-led headline and a plain-language next step — marked by a
 * square severity rail (the only color, so text stays high-contrast).
 * Clicking a row opens the full-screen detail modal with the agent's
 * reasoning. Surfaces are square; sorted most-important first.
 */

type Severity = "action" | "review" | "info";

interface Finding extends OverlayFinding {
  type: string;
  summary: string | null;
  value_annual: number | string | null;
}

const SEVERITY_RAIL: Record<Severity, string> = {
  action: "var(--color-danger)",
  review: "var(--color-warn)",
  info: "var(--color-success)",
};
const RANK: Record<Severity, number> = { action: 0, review: 1, info: 2 };

/** Relative day for the empty-state "Checked …" line. */
function checkedLabel(iso: string): string {
  const days = differenceInCalendarDays(new Date(), new Date(iso));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function AssistantPanel() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { setToast } = useToast();
  const [selected, setSelected] = useState<Finding | null>(null);

  const { data, isLoading } = useAuthedQuery<{
    findings: Finding[];
    lastCheckedAt: string | null;
  }>(["agent-findings", user?.id], user?.id ? "/api/agent/findings" : null);

  const loading = isLoading && !data;
  const findings = [...(data?.findings ?? [])].sort(
    (a, b) =>
      RANK[a.severity] - RANK[b.severity] ||
      Number(b.value_annual ?? 0) - Number(a.value_annual ?? 0),
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["agent-findings", user?.id] });

  async function setStatus(id: string, status: "new" | "dismissed") {
    await authFetch(`/api/agent/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    invalidate();
  }

  async function handleDismiss(f: Finding) {
    setSelected(null);
    await setStatus(f.id, "dismissed");
    setToast({
      description: "Insight dismissed",
      durationMs: 6000,
      action: { label: "Undo", onClick: () => void setStatus(f.id, "new") },
    });
  }

  return (
    <div className="w-full bg-[var(--color-surface-alt)] p-5">
      <div className="flex items-baseline justify-between">
        <span className="card-header">Assistant</span>
        {findings.length > 0 && (
          <span className="text-[11px] font-medium text-[var(--color-muted)]">
            {findings.length} to review
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4 animate-pulse space-y-5">
          {[0, 1].map((i) => (
            <div key={i} className="pl-3">
              <div className="h-3.5 w-3/4 rounded bg-[var(--color-border)]" />
              <div className="mt-2 h-2.5 w-1/2 rounded bg-[var(--color-border)]" />
            </div>
          ))}
        </div>
      ) : findings.length === 0 ? (
        <div className="mt-3">
          <p className="text-[13px] font-medium text-[var(--color-fg)]">
            All caught up
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-muted)]">
            {data?.lastCheckedAt
              ? `Checked ${checkedLabel(data.lastCheckedAt)} · nothing to review`
              : "Nothing to review right now"}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-1">
          {findings.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelected(f)}
              className="group relative -mx-2 flex w-full items-center px-3 py-3 text-left transition-colors hover:bg-[var(--color-fg)]/[0.035]"
            >
              <span
                aria-hidden
                className="absolute left-2 top-1.5 bottom-1.5 w-1"
                style={{ background: SEVERITY_RAIL[f.severity] ?? SEVERITY_RAIL.review }}
              />
              <div className="min-w-0 flex-1 pl-3">
                <p className="text-[13px] font-medium leading-snug text-[var(--color-fg)] line-clamp-2">
                  {f.title}
                </p>
                {f.summary && (
                  <p className="mt-1 text-xs leading-snug text-[var(--color-muted)] line-clamp-2">
                    {f.summary}
                  </p>
                )}
              </div>
              <span className="ml-2 shrink-0 text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                ›
              </span>
            </button>
          ))}
        </div>
      )}

      <FindingOverlay
        finding={selected}
        onClose={() => setSelected(null)}
        onDismiss={(f) => void handleDismiss(f as Finding)}
      />
    </div>
  );
}
