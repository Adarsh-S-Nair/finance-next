"use client";

import Link from "next/link";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";

/**
 * The dashboard's assistant card — reads real findings from the findings
 * engine. Each row leads with a severity-colored rule (the only color,
 * so text stays high-contrast and readable), the title, and a plain-
 * language summary the detector authored — so the value is never a bare,
 * ambiguous "$X/yr". Sorted most-important first.
 */

type Severity = "action" | "review" | "info";

interface Finding {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  summary: string | null;
  value_annual: number | string | null;
}

const SEVERITY_RULE: Record<Severity, string> = {
  action: "var(--color-danger)",
  review: "var(--color-warn)",
  info: "var(--color-success)",
};
const SEVERITY_RANK: Record<Severity, number> = { action: 0, review: 1, info: 2 };

function hrefForFinding(f: Finding): string {
  switch (f.type) {
    case "subscription_price_increase":
      return "/transactions?view=bills";
    case "idle_cash":
      return "/accounts";
    default:
      return "/today";
  }
}

export default function AssistantPanel() {
  const { user } = useUser();
  const { data, isLoading } = useAuthedQuery<{ findings: Finding[] }>(
    ["agent-findings", user?.id],
    user?.id ? "/api/agent/findings" : null,
  );

  const loading = isLoading && !data;
  const findings = [...(data?.findings ?? [])].sort((a, b) => {
    const r = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (r !== 0) return r;
    return Number(b.value_annual ?? 0) - Number(a.value_annual ?? 0);
  });

  return (
    <div className="w-full bg-[var(--color-surface-alt)] p-5">
      <div className="flex items-baseline justify-between">
        <span className="card-header">Assistant</span>
        {findings.length > 0 && (
          <Link
            href="/today"
            className="text-[11px] font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
          >
            {findings.length} to review
          </Link>
        )}
      </div>

      {loading ? (
        <div className="mt-4 animate-pulse space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="pl-3.5">
              <div className="h-3.5 w-3/4 rounded bg-[var(--color-border)]" />
              <div className="mt-2 h-2.5 w-1/2 rounded bg-[var(--color-border)]" />
            </div>
          ))}
        </div>
      ) : findings.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          <span className="text-[var(--color-success)]">✓</span> Nothing needs you right now.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-[var(--color-border)]">
          {findings.map((f) => (
            <Link
              key={f.id}
              href={hrefForFinding(f)}
              className="group relative flex items-start gap-3 py-3.5 first:pt-1"
            >
              <span
                aria-hidden
                className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
                style={{ background: SEVERITY_RULE[f.severity] ?? SEVERITY_RULE.review }}
              />
              <div className="min-w-0 flex-1 pl-3.5">
                <p className="text-[13px] font-medium leading-snug text-[var(--color-fg)] line-clamp-2">
                  {f.title}
                </p>
                {f.summary && (
                  <p className="mt-1 text-xs leading-snug text-[var(--color-muted)] line-clamp-2">
                    {f.summary}
                  </p>
                )}
              </div>
              <span className="self-center text-[var(--color-muted)] opacity-0 transition-opacity group-hover:opacity-100">
                ›
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
