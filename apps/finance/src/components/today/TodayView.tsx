"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import PageContainer from "../layout/PageContainer";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { authFetch } from "../../lib/api/fetch";

/**
 * The assistant's activity view — a compact list of real findings. Each
 * row links to its detail page (the "how we got here" breakdown); a
 * quick Dismiss is available without leaving the list. No mock data.
 */

type Severity = "action" | "review" | "info";

interface Finding {
  id: string;
  severity: Severity;
  title: string;
  summary: string | null;
  value_annual: number | string | null;
}

const SEVERITY_RAIL: Record<Severity, string> = {
  action: "var(--color-danger)",
  review: "var(--color-warn)",
  info: "var(--color-success)",
};
const RANK: Record<Severity, number> = { action: 0, review: 1, info: 2 };

export default function TodayView() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAuthedQuery<{ findings: Finding[] }>(
    ["agent-findings", user?.id],
    user?.id ? "/api/agent/findings" : null,
  );

  const loading = isLoading && !data;
  const findings = [...(data?.findings ?? [])].sort(
    (a, b) =>
      RANK[a.severity] - RANK[b.severity] ||
      Number(b.value_annual ?? 0) - Number(a.value_annual ?? 0),
  );

  async function dismiss(id: string) {
    await authFetch(`/api/agent/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    queryClient.invalidateQueries({ queryKey: ["agent-findings", user?.id] });
  }

  return (
    <PageContainer>
      <div className="max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">Activity</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {loading
              ? "Reviewing your accounts…"
              : findings.length === 0
                ? "All clear — nothing needs your attention."
                : `${findings.length} ${findings.length === 1 ? "thing" : "things"} the assistant flagged`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--color-surface-alt)]" />
            ))}
          </div>
        ) : findings.length === 0 ? (
          <div className="rounded-xl bg-[var(--color-surface-alt)] p-8 text-center">
            <div className="text-sm font-medium text-[var(--color-fg)]">You&apos;re all caught up</div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              The assistant checks your accounts daily and will surface anything worth a look here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {findings.map((f) => (
              <div
                key={f.id}
                className="group relative overflow-hidden rounded-xl bg-[var(--color-surface-alt)]"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ background: SEVERITY_RAIL[f.severity] ?? SEVERITY_RAIL.review }}
                />
                <div className="flex items-center gap-3 py-4 pl-5 pr-4">
                  <Link href={`/today/${f.id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-[var(--color-fg)]">
                      {f.title}
                    </p>
                    {f.summary && (
                      <p className="mt-0.5 text-xs text-[var(--color-muted)]">{f.summary}</p>
                    )}
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismiss(f.id)}
                    className="shrink-0 text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  >
                    Dismiss
                  </button>
                  <Link
                    href={`/today/${f.id}`}
                    aria-label="View details"
                    className="shrink-0 text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                  >
                    ›
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
