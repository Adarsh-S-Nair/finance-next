import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { matchesRule } from '../../../../lib/category-rules';
import type { Json } from '../../../../types/database';

/**
 * Creates a category rule on the user's behalf, gated by user
 * confirmation in the agent's CategoryRuleWidget.
 *
 * Wraps the same `upsert_category_rule` RPC the transactions page uses
 * when the user creates a rule via the "Apply to similar" drawer, so
 * rules created via the agent and rules created via the UI are
 * indistinguishable at the data layer.
 *
 * Conditions are validated against an allowlist of fields and operators
 * — the model could in theory pass anything in the JSON, and we don't
 * want a malformed condition to silently break rule evaluation.
 *
 * Optional `apply_to_existing`: when true, the endpoint also walks the
 * user's transactions and assigns the rule's category to any that
 * match the conditions today — useful when the user wants the rule to
 * cover past activity too, not just future syncs. Direction-mismatched
 * rows are skipped (an income category can't be applied to a negative
 * tx and vice versa — the DB trigger would reject those anyway).
 */
const ALLOWED_FIELDS = new Set(['merchant_name', 'description', 'amount']);
const ALLOWED_OPERATORS = new Set([
  'is',
  'equals',
  'contains',
  'starts_with',
  'is_greater_than',
  'is_less_than',
]);

/**
 * Collapse the `is` / `equals` alias pair onto the field-appropriate
 * canonical operator. See the matching helper in `lib/agent/tools.ts`
 * for the full rationale — short version: `matchesRule` treats them as
 * identical, but the UI convention uses `equals` for amount and `is`
 * for string fields, so two rules that should be the same render
 * differently in Settings if the agent picks the wrong alias. The
 * proposeCategoryRule tool already canonicalises before this route is
 * called; we do it again here in case the rule was posted directly.
 */
function canonicalizeRuleOperator(field: string, operator: string): string {
  if (field === 'amount') {
    if (operator === 'is') return 'equals';
  } else {
    if (operator === 'equals') return 'is';
  }
  return operator;
}

type RuleCondition = {
  field: string;
  operator: string;
  value: string | number;
};

export const POST = withAuth(
  'agent:category-rules:create',
  async (req: NextRequest, userId: string) => {
    const body = (await req.json().catch(() => ({}))) as {
      category_id?: string;
      conditions?: RuleCondition[];
      apply_to_existing?: boolean;
      replace_rule_ids?: string[];
    };

    const categoryId = body.category_id?.trim();
    const rawConditions = Array.isArray(body.conditions) ? body.conditions : [];
    const applyToExisting = body.apply_to_existing === true;
    const replaceIds = Array.isArray(body.replace_rule_ids)
      ? body.replace_rule_ids.filter(
          (id): id is string => typeof id === 'string' && id.length > 0,
        )
      : [];

    if (!categoryId) {
      return NextResponse.json(
        { error: 'category_id is required' },
        { status: 400 },
      );
    }
    if (rawConditions.length === 0) {
      return NextResponse.json(
        { error: 'conditions must be a non-empty array' },
        { status: 400 },
      );
    }

    // Validate each condition. We only let through fields/operators
    // the rule engine actually understands; anything else is rejected
    // rather than silently accepted into the JSONB blob.
    const conditions: RuleCondition[] = [];
    for (const c of rawConditions) {
      if (!c || typeof c !== 'object') {
        return NextResponse.json(
          { error: 'Invalid condition shape' },
          { status: 400 },
        );
      }
      if (typeof c.field !== 'string' || !ALLOWED_FIELDS.has(c.field)) {
        return NextResponse.json(
          { error: `Invalid field: ${String(c.field)}` },
          { status: 400 },
        );
      }
      if (typeof c.operator !== 'string' || !ALLOWED_OPERATORS.has(c.operator)) {
        return NextResponse.json(
          { error: `Invalid operator: ${String(c.operator)}` },
          { status: 400 },
        );
      }
      if (c.value === undefined || c.value === null || c.value === '') {
        return NextResponse.json(
          { error: 'Each condition needs a non-empty value' },
          { status: 400 },
        );
      }
      conditions.push({
        field: c.field,
        operator: canonicalizeRuleOperator(c.field, c.operator),
        value: c.value,
      });
    }

    // Verify the target category exists.
    const { data: cat, error: catError } = await supabaseAdmin
      .from('system_categories')
      .select('id, direction')
      .eq('id', categoryId)
      .maybeSingle();
    if (catError) {
      console.error('[agent:category-rules:create] cat lookup failed', catError);
      return NextResponse.json({ error: 'Failed to load category' }, { status: 500 });
    }
    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Delete any overlapping rules the user opted to replace BEFORE
    // running the upsert. Doing it in this order means:
    //  - If a replace_id had identical conditions to the new rule, the
    //    row is gone, the upsert simply inserts a fresh row with the
    //    new category — same end state as updating in place.
    //  - If a replace_id had structurally different conditions, the
    //    overlap stops firing on future syncs as expected.
    // Scoped to user_id so a stale id from the model can't touch
    // another user's rules.
    let replacedRuleIds: string[] = [];
    if (replaceIds.length > 0) {
      const { data: deleted, error: deleteError } = await supabaseAdmin
        .from('category_rules')
        .delete()
        .eq('user_id', userId)
        .in('id', replaceIds)
        .select('id');
      if (deleteError) {
        console.error('[agent:category-rules:create] replace failed', deleteError);
        return NextResponse.json(
          { error: 'Failed to replace overlapping rules' },
          { status: 500 },
        );
      }
      replacedRuleIds = (deleted ?? []).map((row) => row.id);
    }

    // Use the same RPC the transactions page uses; it handles upsert
    // semantics so re-creating a rule for the same category replaces
    // the existing one.
    const { error: rpcError } = await supabaseAdmin.rpc(
      'upsert_category_rule',
      {
        p_user_id: userId,
        p_category_id: categoryId,
        p_conditions: conditions as unknown as Json,
      },
    );

    if (rpcError) {
      console.error('[agent:category-rules:create] rpc failed', rpcError);
      return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }

    let appliedToExisting: number | null = null;
    if (applyToExisting) {
      appliedToExisting = await applyRuleToExisting(
        userId,
        categoryId,
        cat.direction,
        conditions,
      );
    }

    return NextResponse.json({
      ok: true,
      applied_to_existing: appliedToExisting,
      replaced_rule_ids: replacedRuleIds,
    });
  },
);

/**
 * Walks the user's transactions, picks the ones that match the rule
 * conditions today, filters by direction compatibility, and bulk-
 * updates them to the new category. Returns the number updated.
 *
 * Direction filter: the DB trigger blocks assigning an income
 * category to a negative-amount transaction (and vice versa), so we
 * pre-filter rather than letting the trigger reject the whole batch.
 */
async function applyRuleToExisting(
  userId: string,
  categoryId: string,
  direction: string,
  conditions: RuleCondition[],
): Promise<number> {
  const { data: txs, error } = await supabaseAdmin
    .from('transactions')
    .select(
      'id, amount, description, merchant_name, category_id, accounts!inner(user_id)',
    )
    .eq('accounts.user_id', userId);
  if (error) {
    console.error('[agent:category-rules:create] tx lookup failed', error);
    return 0;
  }
  const candidates = (txs ?? []) as Array<{
    id: string;
    amount: number;
    description: string | null;
    merchant_name: string | null;
    category_id: string | null;
  }>;

  // Reuse the same matchesRule logic the Plaid sync runs on incoming
  // transactions so retroactive application is consistent with future
  // application. Build a minimal rule shape — matchesRule only reads
  // `conditions`.
  type RuleShape = Parameters<typeof matchesRule>[1];
  const ruleShape = {
    conditions,
  } as unknown as RuleShape;

  const matching = candidates.filter((tx) => {
    if (!matchesRule(tx as Parameters<typeof matchesRule>[0], ruleShape)) return false;
    if (tx.category_id === categoryId) return false; // already there
    const amt = Number(tx.amount);
    if (!Number.isFinite(amt) || amt === 0) return true;
    if (direction === 'both') return true;
    if (direction === 'income' && amt < 0) return false;
    if (direction === 'expense' && amt > 0) return false;
    return true;
  });

  if (matching.length === 0) return 0;

  const ids = matching.map((t) => t.id);
  const { error: updateError } = await supabaseAdmin
    .from('transactions')
    .update({
      category_id: categoryId,
      is_user_categorized: true,
      is_unmatched_transfer: false,
    })
    .in('id', ids);
  if (updateError) {
    console.error('[agent:category-rules:create] retro update failed', updateError);
    return 0;
  }
  return matching.length;
}
