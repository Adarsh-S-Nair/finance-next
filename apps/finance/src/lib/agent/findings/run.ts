import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@zervo/supabase";
import { format, startOfMonth, subMonths } from "date-fns";
import { DETECTORS } from "./registry";
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
} from "./types";

/**
 * Typical monthly spending (median of the last 3 complete months,
 * outflows only, internal transfers excluded). Used to size the
 * idle-cash buffer. Median, not mean — a single big one-off month
 * shouldn't distort what the user "typically" spends.
 */
async function computeMonthlySpending(
  userId: string,
  admin: SupabaseClient<Database>,
): Promise<number> {
  const now = new Date();
  const monthKeys = recentCompleteMonths(now, 3);
  const windowStart = format(subMonths(startOfMonth(now), 3), "yyyy-MM-dd");
  const windowEnd = format(startOfMonth(now), "yyyy-MM-dd");

  const { data: txRows, error } = await admin
    .from("transactions")
    .select("amount, date, personal_finance_category, accounts!inner(user_id)")
    .eq("accounts.user_id", userId)
    .lt("amount", 0)
    .gte("date", windowStart)
    .lt("date", windowEnd);

  if (error) throw error;

  const txns: SpendingTxn[] = (txRows ?? []).map((t) => ({
    date: (t.date as string | null) ?? "",
    amount: Number(t.amount),
    primary:
      (t.personal_finance_category as { primary?: string } | null)?.primary ?? null,
  }));

  return medianMonthlySpending(txns, monthKeys);
}

/**
 * Run every registered detector for one user and upsert the results.
 *
 * This is the "agent sweep": load the user's data once, run the pure
 * detectors over it, and idempotently persist what they find. Re-running
 * updates existing findings (matched on user_id + dedupe_key) rather than
 * duplicating them, and preserves a finding's status — a dismissed
 * finding stays dismissed when the sweep runs again, because `status` is
 * intentionally omitted from the upsert payload (DB default on insert,
 * untouched on conflict).
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

  const monthlySpending = await computeMonthlySpending(userId, admin);

  const ctx: DetectorContext = { streams, accounts, monthlySpending };
  const drafts: FindingDraft[] = [];
  for (const detector of DETECTORS) drafts.push(...detector(ctx));

  if (drafts.length > 0) {
    const now = new Date().toISOString();
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
      updated_at: now,
    }));

    const { error: upsertError } = await admin
      .from("agent_findings")
      .upsert(rows, { onConflict: "user_id,dedupe_key" });
    if (upsertError) throw upsertError;
  }

  return { drafts };
}
