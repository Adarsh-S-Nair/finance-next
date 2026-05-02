import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * Commits an update to the user's profile fields the agent is allowed
 * to change. Currently just monthly_income; future expansion (savings
 * goal, household size, etc) lands here too.
 *
 * Auth-scoped via the user_id filter on the update. Admin client
 * bypasses RLS, so we enforce ownership manually.
 *
 * Gated by user confirmation via the agent's IncomeProposalWidget —
 * the agent calls propose_income_update which renders the widget,
 * the widget POSTs here on accept.
 */
export const POST = withAuth(
  'agent:user-profile:write',
  async (req: NextRequest, userId: string) => {
    const body = (await req.json().catch(() => ({}))) as {
      monthly_income?: number | null;
    };

    // Only one field is allowed through right now. Reject anything
    // unexpected so the surface area stays narrow.
    const updates: { monthly_income?: number | null } = {};
    if (body.monthly_income !== undefined) {
      const value = body.monthly_income;
      if (value !== null) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric < 0) {
          return NextResponse.json(
            { error: 'monthly_income must be a non-negative number or null' },
            { status: 400 },
          );
        }
        updates.monthly_income = numeric;
      } else {
        updates.monthly_income = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No supported fields in request body' },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('[agent:user-profile:write] update failed', error);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, updates });
  },
);
