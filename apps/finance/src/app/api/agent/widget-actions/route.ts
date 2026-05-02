import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * Records the user's accept/decline action on an inline agent widget.
 * Keyed by Anthropic's tool_use_id, scoped to the calling user.
 *
 * Idempotent via the (user_id, tool_use_id) unique constraint —
 * an upsert lets the user change their mind (e.g. decline a
 * suggestion, then later accept the same one) without surfacing
 * the unique-key violation. Latest action wins.
 */
export const POST = withAuth(
  'agent:widget-actions:create',
  async (req: NextRequest, userId: string) => {
    const body = (await req.json().catch(() => ({}))) as {
      tool_use_id?: string;
      action?: string;
    };
    const toolUseId = body.tool_use_id?.trim();
    const action = body.action?.trim();
    if (!toolUseId) {
      return NextResponse.json(
        { error: 'tool_use_id is required' },
        { status: 400 },
      );
    }
    if (action !== 'accepted' && action !== 'declined') {
      return NextResponse.json(
        { error: "action must be 'accepted' or 'declined'" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin
      .from('user_agent_widget_actions')
      .upsert(
        {
          user_id: userId,
          tool_use_id: toolUseId,
          action,
        },
        { onConflict: 'user_id,tool_use_id' },
      );

    if (error) {
      console.error('[agent:widget-actions:create] upsert failed', error);
      return NextResponse.json(
        { error: 'Failed to record action' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, action });
  },
);
