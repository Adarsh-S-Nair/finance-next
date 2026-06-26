import { withAuth } from "../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import {
  detectIncome,
  type IncomeProfile,
  type IncomeTxn,
} from "../../../../lib/income/detect";
import { effectiveCategory } from "../../../../lib/income/userCategory";

/**
 * GET /api/income/profile
 *
 * The user's income profile — the primary paycheck (employer, expected
 * amount, cadence, next predicted deposit) plus every recurring income
 * stream and the monthly total. Read by the dashboard's "Next paycheck"
 * card.
 *
 * Normally served from `income_profiles`, written by the nightly sweep.
 * If the sweep hasn't run for this user yet (no row), we compute it
 * on the fly from their inflow transactions so the card still works — the
 * computation is the same deterministic function the sweep uses, just not
 * persisted here.
 */

const TXN_WINDOW_DAYS = 365;

interface PrimaryDTO {
  employer: string | null;
  cadence: string | null;
  expectedAmount: number | null;
  lastAmount: number | null;
  lastDate: string | null;
  nextDate: string | null;
  confidence: number | null;
}

interface ProfileDTO {
  source: string;
  computedAt: string | null;
  primary: PrimaryDTO | null;
  streams: unknown[];
  monthlyIncome: number;
}

function fromComputed(profile: IncomeProfile): ProfileDTO {
  const p = profile.primary;
  return {
    source: "computed",
    computedAt: null,
    primary: p
      ? {
          employer: p.label,
          cadence: p.cadence,
          expectedAmount: p.expectedAmount,
          lastAmount: p.lastAmount,
          lastDate: p.lastDate,
          nextDate: p.nextDate,
          confidence: p.confidence,
        }
      : null,
    streams: profile.streams,
    monthlyIncome: profile.monthlyIncome,
  };
}

export const GET = withAuth("income:profile", async (_request, userId) => {
  const { data: row, error } = await supabaseAdmin
    .from("income_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (row) {
    const dto: ProfileDTO = {
      source: row.source,
      computedAt: row.computed_at,
      // A paycheck was detected iff we stored an expected amount.
      primary:
        row.expected_amount != null
          ? {
              employer: row.employer,
              cadence: row.cadence,
              expectedAmount: Number(row.expected_amount),
              lastAmount: row.last_amount == null ? null : Number(row.last_amount),
              lastDate: row.last_date,
              nextDate: row.next_date,
              confidence: row.confidence == null ? null : Number(row.confidence),
            }
          : null,
      streams: Array.isArray(row.streams) ? (row.streams as unknown[]) : [],
      monthlyIncome: row.monthly_income == null ? 0 : Number(row.monthly_income),
    };
    return Response.json(dto);
  }

  // Fallback: compute from inflow transactions (sweep hasn't run yet).
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - TXN_WINDOW_DAYS);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  const { data: txRows, error: txError } = await supabaseAdmin
    .from("transactions")
    .select(
      "amount, date, merchant_name, description, personal_finance_category, account_id, is_user_categorized, system_categories(label, category_groups(name)), accounts!inner(user_id)",
    )
    .eq("accounts.user_id", userId)
    .gt("amount", 0)
    .gte("date", windowStartStr);

  if (txError) throw txError;

  const incomeTxns: IncomeTxn[] = (txRows ?? []).map((t) => {
    const pfc = t.personal_finance_category as
      | { primary?: string; detailed?: string }
      | null;
    const sc = t.system_categories as
      | { label?: string | null; category_groups?: { name?: string | null } | null }
      | null;
    const eff = effectiveCategory({
      pfcPrimary: pfc?.primary ?? null,
      pfcDetailed: pfc?.detailed ?? null,
      isUserCategorized: Boolean(t.is_user_categorized),
      userLabel: sc?.label ?? null,
      userGroup: sc?.category_groups?.name ?? null,
    });
    return {
      date: (t.date as string | null) ?? "",
      amount: Number(t.amount),
      merchant_name: (t.merchant_name as string | null) ?? null,
      description: (t.description as string | null) ?? null,
      category_primary: eff.primary,
      category_detailed: eff.detailed,
      account_id: t.account_id as string,
    };
  });

  return Response.json(fromComputed(detectIncome(incomeTxns, new Date())));
});
