import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../../lib/supabase/admin';

/**
 * Soft-delete a memory: flips is_active to false. We keep the row so
 * the audit trail stays queryable (e.g. "I told the agent to forget
 * X — but did it actually save it?"), and so the memory doesn't leak
 * back into future system prompts. Hard delete only happens on user
 * deletion via the auth.users cascade.
 *
 * Used both by the settings page (user clicks the X next to a memory)
 * and by the inline "forget this" affordance in the chat after the
 * agent saves something.
 */
export const DELETE = withAuth<{ id: string }>(
  'agent:memories:delete',
  async (_req: NextRequest, userId: string, { params }) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    // Auth scope via user_id filter. Admin client bypasses RLS so we
    // enforce ownership manually.
    const { error } = await supabaseAdmin
      .from('user_agent_memories')
      .update({ is_active: false })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[agent:memories:delete] update failed', error);
      return NextResponse.json({ error: 'Failed to forget memory' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  },
);
