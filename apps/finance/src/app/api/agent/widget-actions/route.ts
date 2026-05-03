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
    // Three valid action shapes:
    // - "accepted" / "declined" — proposal widgets (budget, income,
    //   recategorization, etc).
    // - "answered:<value>" — question widgets, where the suffix is the
    //   user's chosen option label or free-form text. Capped at 500
    //   chars to stop a buggy widget from writing megabytes.
    if (
      action !== 'accepted' &&
      action !== 'declined' &&
      !(typeof action === 'string' && action.startsWith('answered:'))
    ) {
      return NextResponse.json(
        { error: "action must be 'accepted', 'declined', or 'answered:<value>'" },
        { status: 400 },
      );
    }
    if (action && action.length > 500) {
      return NextResponse.json(
        { error: 'action exceeds 500 chars' },
        { status: 400 },
      );
    }

    // Look up the message that contains this tool_use so we can FK to
    // it (cascade delete on conversation removal). Two-step query:
    // first the user's conversation ids, then the assistant messages
    // in those conversations. Falls back to NULL if unmatched, since
    // the schema permits NULL message_id (backwards compat) and the
    // action recording is still useful even without the FK.
    let messageId: string | null = null;
    const { data: convs } = await supabaseAdmin
      .from('user_agent_conversations')
      .select('id')
      .eq('user_id', userId);
    const convIds = (convs ?? []).map((c) => c.id);
    if (convIds.length > 0) {
      // Cap at 200 recent assistant rows. The tool_use we're looking
      // for is almost always in the very latest assistant message
      // (user just clicked accept/decline on a freshly streamed
      // widget); the cap is just a safety bound for unusual paths.
      const { data: messages } = await supabaseAdmin
        .from('user_agent_messages')
        .select('id, content')
        .in('conversation_id', convIds)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(200);
      for (const row of messages ?? []) {
        const content = row.content as { blocks?: Array<{ type?: string; id?: string }> } | null;
        const found = content?.blocks?.find(
          (b) => b.type === 'tool_use' && b.id === toolUseId,
        );
        if (found) {
          messageId = row.id;
          break;
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('user_agent_widget_actions')
      .upsert(
        {
          user_id: userId,
          tool_use_id: toolUseId,
          action,
          message_id: messageId,
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
