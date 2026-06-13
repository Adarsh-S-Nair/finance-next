"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import PageContainer from "../layout/PageContainer";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { authFetch } from "../../lib/api/fetch";

/**
 * The assistant's activity view — the detail surface behind the
 * dashboard card. Reads real findings from the findings engine and
 * shows each in full: severity, title, the plain-language explanation,
 * and a dismiss action. No mock data.
 */

type Severity = "action" | "review" | "info";

interface Finding {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  body: string;
  summary: string | null;
  value_annual: number | string | null;
  suggested_action: { label?: string } | null;
}

const SEVERITY: Record<Severity, { rule: string; label: string }> = {
  action: { rule: "var(--color-danger)", label: "Action recommended" },
  review: { rule: "var(--color-warn)", label: "Worth a look" },
  info: { rule: "var(--color-success)", label: "Good to know" },
};
const RANK: Record<Severity, number> = { action: 0, review: 1, info: 2 };

function hrefForFinding(f: Finding): string {
  switch (f.type) {
    case "subscription_price_increase":
      return "/transactions?view=bills";
    case "idle_cash":
      return "/accounts";
    default:
      return "/dashboard";
  }
}

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
          <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
            Activity
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {loading
              ? "Reviewing your accounts…"
              : findings.length === 0
                ? "All clear — nothing needs your attention."
                : `${findings.length} ${findings.length === 1 ? "thing" : "things"} the assistant flagged`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-[var(--color-surface-alt)]" />
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
          <div className="space-y-4">
            {findings.map((f) => {
              const sev = SEVERITY[f.severity] ?? SEVERITY.review;
              return (
                <div key={f.id} className="relative overflow-hidden rounded-xl bg-[var(--color-surface-alt)] p-5">
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ background: sev.rule }}
                  />
                  <div className="pl-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                      {sev.label}
                    </span>
                    <h2 className="mt-1.5 text-[15px] font-medium leading-snug text-[var(--color-fg)]">
                      {f.title}
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                      {f.body}
                    </p>
                    <div className="mt-4 flex items-center gap-4">
                      <Link
                        href={hrefForFinding(f)}
                        className="inline-flex items-center rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)]"
                      >
                        {f.suggested_action?.label ?? "View"}
                      </Link>
                      <button
                        type="button"
                        onClick={() => dismiss(f.id)}
                        className="text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
