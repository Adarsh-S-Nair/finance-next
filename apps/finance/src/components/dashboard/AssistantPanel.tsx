"use client";

import Link from "next/link";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";

/**
 * The dashboard's assistant card — now reading real findings from the
 * findings engine (`GET /api/agent/findings`) rather than mock data.
 * One cohesive list: each finding is a row led by a thin severity-
 * colored rule, with the title, a colored status word, and its
 * annualized value. Empty and loading states included, because a quiet
 * "nothing needs you" is the common, correct case.
 */

type Severity = "action" | "review" | "info";

interface Finding {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  body: string;
  value_annual: number | string | null;
  suggested_action: { label?: string } | null;
  subject_id: string | null;
}

const SEVERITY: Record<Severity, { label: string; color: string }> = {
  action: { label: "Action recommended", color: "var(--color-danger)" },
  review: { label: "Worth reviewing", color: "var(--color-warn)" },
  info: { label: "No action needed", color: "var(--color-success)" },
};

// Where a finding's row taps through to — the real surface for its kind.
function hrefForFinding(f: Finding): string {
  switch (f.type) {
    case "subscription_price_increase":
      return "/transactions?view=bills";
    default:
      return "/today";
  }
}

function annualLabel(value: number | string | null): string | null {
  const n = Number(value);
  if (!value || !Number.isFinite(n) || n <= 0) return null;
  return `$${Math.round(n).toLocaleString()}/yr`;
}

export default function AssistantPanel() {
  const { user } = useUser();
  const { data, isLoading } = useAuthedQuery<{ findings: Finding[] }>(
    ["agent-findings", user?.id],
    user?.id ? "/api/agent/findings" : null,
  );

  const findings = data?.findings ?? [];
  const loading = isLoading && !data;

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
              <div className="mt-2 h-2.5 w-1/3 rounded bg-[var(--color-border)]" />
            </div>
          ))}
        </div>
      ) : findings.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          <span className="text-[var(--color-success)]">✓</span> Nothing needs you right now.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-[var(--color-border)]">
          {findings.map((f) => {
            const sev = SEVERITY[f.severity] ?? SEVERITY.review;
            const value = annualLabel(f.value_annual);
            return (
              <Link
                key={f.id}
                href={hrefForFinding(f)}
                className="group relative flex items-start gap-2 py-3.5"
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-4 bottom-4 w-[3px] rounded-full"
                  style={{ background: sev.color }}
                />
                <div className="min-w-0 flex-1 pl-3.5">
                  <p className="text-[13px] font-medium leading-snug text-[var(--color-fg)]">
                    {f.title}
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
    </div>
  );
}
