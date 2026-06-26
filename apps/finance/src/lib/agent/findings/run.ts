import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@zervo/supabase";
import { format, subDays } from "date-fns";
import { DETECTORS } from "./registry";
import {
  decideStatus,
  selectStaleKeys,
  type ExistingFinding,
  type FindingStatus,
} from "./lifecycle";
import {
  medianMonthlySpending,
  recentCompleteMonths,
  type SpendingTxn,
} from "./spending";
import { detectIncome, type IncomeTxn } from "../../income/detect";
import { refineIncomeProfile } from "../../income/refine";
import { resolveAgentConfig } from "../platformConfig";
import Anthropic from "@anthropic-ai/sdk";
import type {
  AccountInput,
  DetectorContext,
  FindingDraft,
  RecurringStreamInput,
  TransactionInput,
} from "./types";

// How far back to pull transactions. A full year so the fee/interest
// detectors can report "this year"; the spending median only reads the
// most recent complete months out of the same window.
const TXN_WINDOW_DAYS = 365;

/**
 * Load the user's outflow transactions over the trailing year (one query,
 * reused by every transaction-backed detector and the spending median).
 */
async function loadTransactions(
  userId: string,
  now: Date,
  admin: SupabaseClient<Database>,
): Promise<TransactionInput[]> {
  const windowStart = format(subDays(now, TXN_WINDOW_DAYS), "yyyy-MM-dd");

  const { data: txRows, error } = await admin
    .from("transactions")
    .select(
      "id, amount, date, merchant_name, description, personal_finance_category, accounts!inner(user_id)",
    )
    .eq("accounts.user_id", userId)
    .lt("amount", 0)
    .gte("date", windowStart);

  if (error) throw error;

  return (txRows ?? []).map((t) => {
    const pfc = t.personal_finance_category as
      | { primary?: string; detailed?: string }
      | null;
    return {
      id: t.id as string,
      date: (t.date as string | null) ?? "",
      amount: Number(t.amount),
      merchant_name: (t.merchant_name as string | null) ?? null,
      description: (t.description as string | null) ?? "",
      category_primary: pfc?.primary ?? null,
      category_detailed: pfc?.detailed ?? null,
    };
  });
}

/**
 * Load the user's inflow transactions over the trailing year — the raw
 * material for income detection (paychecks, interest), separate from the
 * outflow query above so each stays a tight single-purpose scan.
 */
async function loadIncomeTransactions(
  userId: string,
  now: Date,
  admin: SupabaseClient<Database>,
): Promise<IncomeTxn[]> {
  const windowStart = format(subDays(now, TXN_WINDOW_DAYS), "yyyy-MM-dd");

  const { data: txRows, error } = await admin
    .from("transactions")
    .select(
      "amount, date, merchant_name, description, personal_finance_category, account_id, accounts!inner(user_id)",
    )
    .eq("accounts.user_id", userId)
    .gt("amount", 0)
    .gte("date", windowStart);

  if (error) throw error;

  return (txRows ?? []).map((t) => {
    const pfc = t.personal_finance_category as
      | { primary?: string; detailed?: string }
      | null;
    return {
      date: (t.date as string | null) ?? "",
      amount: Number(t.amount),
      merchant_name: (t.merchant_name as string | null) ?? null,
      description: (t.description as string | null) ?? null,
      category_primary: pfc?.primary ?? null,
      category_detailed: pfc?.detailed ?? null,
      account_id: t.account_id as string,
    };
  });
}

/**
 * Typical monthly spending (median of the last 3 complete months,
 * outflows only, internal transfers excluded) from already-loaded
 * transactions. Used to size the idle-cash buffer. Median, not mean — a
 * single big one-off month shouldn't distort what the user "typically"
 * spends.
 */
function computeMonthlySpending(
  transactions: TransactionInput[],
  now: Date,
): number {
  const monthKeys = recentCompleteMonths(now, 3);
  const txns: SpendingTxn[] = transactions.map((t) => ({
    date: t.date,
    amount: t.amount,
    primary: t.category_primary,
  }));
  return medianMonthlySpending(txns, monthKeys);
}

/**
 * Run every registered detector for one user and upsert the results.
 *
 * This is the "agent sweep": load the user's data once, run the pure
 * detectors over it, and idempotently persist what they find. Re-running
 * updates existing findings (matched on user_id + dedupe_key) rather than
 * duplicating them. Each finding's status is decided by `decideStatus`:
 * active stays active, dismissed stays dismissed unless the situation got
 * materially worse (then it re-surfaces).
 *
 * A nightly cron loops this over all users; the API route runs it for the
 * authenticated caller on demand.
 */
export async function runFindingsForUser(
  userId: string,
  admin: SupabaseClient<Database>,
): Promise<{ drafts: FindingDraft[] }> {
  const { data: streamRows, error } = await admin
    .from("recurring_streams")
    .select(
      "stream_id, stream_type, status, is_active, category_primary, frequency, average_amount, last_amount, merchant_name, description, last_date",
    )
    .eq("user_id", userId);

  if (error) throw error;

  const streams: RecurringStreamInput[] = (streamRows ?? []).map((r) => ({
    stream_id: r.stream_id,
    stream_type: r.stream_type,
    status: r.status,
    is_active: r.is_active,
    category_primary: r.category_primary,
    frequency: r.frequency,
    average_amount: Number(r.average_amount),
    last_amount: Number(r.last_amount),
    merchant_name: r.merchant_name,
    description: r.description,
    last_date: r.last_date,
  }));

  const { data: accountRows, error: accountsError } = await admin
    .from("accounts")
    .select("id, name, subtype, plaid_balance_current")
    .eq("user_id", userId)
    .eq("type", "depository");

  if (accountsError) throw accountsError;

  const accounts: AccountInput[] = (accountRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    subtype: r.subtype,
    balance: Number(r.plaid_balance_current ?? 0),
  }));

  const now = new Date();
  const transactions = await loadTransactions(userId, now, admin);
  const monthlySpending = computeMonthlySpending(transactions, now);

  // Detect income from inflows (paychecks, interest…). Computed here so the
  // income-anomaly detector can read it and so we can persist the canonical
  // profile the "Next paycheck" card renders.
  const incomeTxns = await loadIncomeTransactions(userId, now, admin);
  const incomeProfile = detectIncome(incomeTxns, now);

  const ctx: DetectorContext = {
    streams,
    accounts,
    transactions,
    monthlySpending,
    incomeProfile,
    now,
  };
  const drafts: FindingDraft[] = [];
  for (const detector of DETECTORS) drafts.push(...detector(ctx));

  // Existing findings for this user. Loaded unconditionally — even with
  // zero drafts — because we need them for BOTH directions of an
  // idempotent sweep: deciding each new draft's status, and resolving
  // findings whose situation has since cleared.
  const { data: existingRows, error: existingError } = await admin
    .from("agent_findings")
    .select("dedupe_key, status, value_annual")
    .eq("user_id", userId);
  if (existingError) throw existingError;

  const nowIso = new Date().toISOString();

  if (drafts.length > 0) {
    // Decide each one's status on this sweep: active ones stay active,
    // dismissed ones stay dismissed unless they got materially worse, and
    // previously-resolved ones that fired again come back as new. See
    // decideStatus.
    const existingByKey = new Map<string, ExistingFinding>(
      (existingRows ?? []).map((r) => [
        r.dedupe_key,
        {
          status: r.status as FindingStatus,
          value_annual: r.value_annual == null ? null : Number(r.value_annual),
        },
      ]),
    );

    const rows = drafts.map((d) => ({
      user_id: userId,
      type: d.type,
      severity: d.severity,
      title: d.title,
      body: d.body,
      summary: d.summary,
      evidence: d.evidence as Json,
      value_annual: d.valueAnnual ?? null,
      suggested_action: (d.suggestedAction ?? null) as Json,
      subject_id: d.subjectId,
      dedupe_key: d.dedupeKey,
      status: decideStatus(existingByKey.get(d.dedupeKey), d.valueAnnual ?? null),
      updated_at: nowIso,
    }));

    const { error: upsertError } = await admin
      .from("agent_findings")
      .upsert(rows, { onConflict: "user_id,dedupe_key" });
    if (upsertError) throw upsertError;
  }

  // Reconcile the other direction: any finding that was active but isn't
  // detected this sweep has had its underlying situation clear, so mark it
  // resolved (which drops it from the user-facing new/seen lists). This is
  // the half that was missing — without it a flag lingers forever after the
  // thing it described is gone, e.g. an idle-cash alert still showing after
  // the cash was moved. A full data-load failure throws above before we get
  // here, so a transient error can never mass-resolve a user's findings.
  const detectedKeys = new Set(drafts.map((d) => d.dedupeKey));
  const staleKeys = selectStaleKeys(
    (existingRows ?? []).map((r) => ({
      dedupe_key: r.dedupe_key,
      status: r.status as FindingStatus,
    })),
    detectedKeys,
  );

  if (staleKeys.length > 0) {
    const { error: resolveError } = await admin
      .from("agent_findings")
      .update({ status: "resolved", resolved_at: nowIso, updated_at: nowIso })
      .eq("user_id", userId)
      .in("dedupe_key", staleKeys);
    if (resolveError) throw resolveError;
  }

  // Persist the canonical income profile the dashboard reads. Written with
  // source 'algorithm'; a future assistant-refinement pass writes
  // 'assistant' and would guard against being clobbered here.
  const p = incomeProfile.primary;
  const { error: incomeError } = await admin.from("income_profiles").upsert(
    {
      user_id: userId,
      source: "algorithm",
      employer: p?.label ?? null,
      cadence: p?.cadence ?? null,
      expected_amount: p?.expectedAmount ?? null,
      last_amount: p?.lastAmount ?? null,
      last_date: p?.lastDate ?? null,
      next_date: p?.nextDate ?? null,
      monthly_income: incomeProfile.monthlyIncome,
      confidence: p?.confidence ?? null,
      streams: incomeProfile.streams as unknown as Json,
      excluded: incomeProfile.excluded as unknown as Json,
      computed_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: "user_id" },
  );
  if (incomeError) throw incomeError;

  // Assistant refinement: turn the raw payroll descriptor into a
  // recognisable employer name ("Direct deposit from 100-SFDC INC." →
  // "Salesforce") and mark the row assistant-authored. Best-effort — if no
  // API key is configured or the model call fails, we keep the algorithm's
  // label. Re-runs each sweep, so it stays correct as the profile changes.
  if (incomeProfile.primary) {
    try {
      const cfg = await resolveAgentConfig();
      const client = new Anthropic({ apiKey: cfg.apiKey });
      const refined = await refineIncomeProfile(incomeProfile, client, cfg.model);
      if (refined?.employer) {
        await admin
          .from("income_profiles")
          .update({
            employer: refined.employer,
            source: "assistant",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }
    } catch (e) {
      console.warn(
        "[findings] income refinement skipped:",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // Stamp a faithful "swept at" time regardless of whether any finding
  // changed — this is what the assistant card's "Checked …" line reads, so
  // a quiet night still reflects that the sweep ran.
  const { error: sweptError } = await admin
    .from("user_profiles")
    .update({ agent_last_swept_at: nowIso })
    .eq("id", userId);
  if (sweptError) throw sweptError;

  return { drafts };
}
