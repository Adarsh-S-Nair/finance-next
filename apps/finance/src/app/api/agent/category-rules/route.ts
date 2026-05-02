import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
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
    };

    const categoryId = body.category_id?.trim();
    const rawConditions = Array.isArray(body.conditions) ? body.conditions : [];

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
      conditions.push({ field: c.field, operator: c.operator, value: c.value });
    }

    // Verify the target category exists.
    const { data: cat, error: catError } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .eq('id', categoryId)
      .maybeSingle();
    if (catError) {
      console.error('[agent:category-rules:create] cat lookup failed', catError);
      return NextResponse.json({ error: 'Failed to load category' }, { status: 500 });
    }
    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
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

    return NextResponse.json({ ok: true });
  },
);
