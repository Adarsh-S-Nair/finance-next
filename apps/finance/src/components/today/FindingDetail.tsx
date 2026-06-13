"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import PageContainer from "../layout/PageContainer";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { authFetch } from "../../lib/api/fetch";

/**
 * The finding detail / "how the assistant got here" view. Shows the
 * finding in full plus the detector's step-by-step reasoning, so the
 * user can audit exactly how the number was reached.
 */

type Severity = "action" | "review" | "info";

interface ReasoningStep {
  label: string;
  value: string;
  note?: string;
}

interface Finding {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  body: string;
  evidence: { reasoning?: ReasoningStep[] } | null;
  suggested_action: { label?: string } | null;
}

const SEVERITY: Record<Severity, { rail: string; label: string }> = {
  action: { rail: "var(--color-danger)", label: "Action recommended" },
  review: { rail: "var(--color-warn)", label: "Worth a look" },
  info: { rail: "var(--color-success)", label: "Good to know" },
};

function actionHref(f: Finding): string {
  switch (f.type) {
    case "subscription_price_increase":
      return "/transactions?view=bills";
    case "idle_cash":
      return "/accounts";
    default:
      return "/dashboard";
  }
}

export default function FindingDetail({ id }: { id: string }) {
  const { user } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useAuthedQuery<{ finding: Finding }>(
    ["agent-finding", id],
    user?.id ? `/api/agent/findings/${id}` : null,
  );

  const finding = data?.finding;

  async function dismiss() {
    await authFetch(`/api/agent/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "dismissed" }),
    });
    queryClient.invalidateQueries({ queryKey: ["agent-findings", user?.id] });
    router.push("/today");
  }

  return (
    <PageContainer>
      <div className="max-w-2xl">
        <Link
          href="/today"
          className="text-xs font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          ‹ Activity
        </Link>

        {isLoading && !finding ? (
          <div className="mt-6 animate-pulse space-y-3">
            <div className="h-3 w-24 rounded bg-[var(--color-border)]" />
            <div className="h-6 w-2/3 rounded bg-[var(--color-border)]" />
            <div className="h-40 w-full rounded-xl bg-[var(--color-surface-alt)]" />
          </div>
        ) : error || !finding ? (
          <p className="mt-8 text-sm text-[var(--color-muted)]">
            This insight isn&apos;t available — it may have been dismissed or resolved.
          </p>
        ) : (
          <FindingBody finding={finding} onDismiss={dismiss} />
        )}
      </div>
    </PageContainer>
  );
}

function FindingBody({ finding, onDismiss }: { finding: Finding; onDismiss: () => void }) {
  const sev = SEVERITY[finding.severity] ?? SEVERITY.review;
  const steps = finding.evidence?.reasoning ?? [];

  return (
    <div className="mt-5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
        {sev.label}
      </span>
      <h1 className="mt-2 text-2xl font-medium leading-tight tracking-tight text-[var(--color-fg)]">
        {finding.title}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{finding.body}</p>

      {steps.length > 0 && (
        <div className="mt-8">
          <div className="card-header mb-4">How the assistant got here</div>
          <div className="relative overflow-hidden rounded-xl bg-[var(--color-surface-alt)]">
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: sev.rail }} />
            <div className="divide-y divide-[var(--color-border)] pl-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-baseline justify-between gap-4 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="text-sm text-[var(--color-fg)]">{step.label}</div>
                    {step.note && (
                      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{step.note}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-fg)]">
                    {step.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 flex items-center gap-4">
        <Link
          href={actionHref(finding)}
          className="inline-flex items-center rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)]"
        >
          {finding.suggested_action?.label ?? "View"}
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
