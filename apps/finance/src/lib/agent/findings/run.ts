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

  const ctx: DetectorContext = {
    streams,
    accounts,
    transactions,
    monthlySpending,
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

  return { drafts };
}
