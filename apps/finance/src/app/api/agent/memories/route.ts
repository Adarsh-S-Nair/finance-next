import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * GET — list every active memory for the calling user, newest first.
 * Used by the settings page so the user can review and delete what
 * the agent has saved about them.
 *
 * POST — create a memory manually from the settings UI. The agent
 * has its own path (the remember_user_fact tool, which goes through
 * lib/agent/tools.ts), but the user can add their own facts here too.
 */

export const GET = withAuth(
  'agent:memories:list',
  async (_req: NextRequest, userId: string) => {
    const { data, error } = await supabaseAdmin
      .from('user_agent_memories')
      .select('id, content, source, created_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[agent:memories:list] failed', error);
      return NextResponse.json(
        { error: 'Failed to load memories' },
        { status: 500 },
      );
    }

    return NextResponse.json({ memories: data ?? [] });
  },
);

export const POST = withAuth(
  'agent:memories:create',
  async (req: NextRequest, userId: string) => {
    const body = (await req.json().catch(() => ({}))) as {
      content?: string;
    };
    const content = body.content?.trim() ?? '';
    if (content.length === 0) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json(
        { error: 'content must be 1000 characters or fewer' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('user_agent_memories')
      .insert({
        user_id: userId,
        content,
        // 'user' source = added via settings UI (this endpoint), as
        // opposed to 'agent' which is set by the remember_user_fact tool.
        source: 'user',
      })
      .select('id, content, source, created_at')
      .single();

    if (error) {
      console.error('[agent:memories:create] insert failed', error);
      return NextResponse.json({ error: 'Failed to save memory' }, { status: 500 });
    }

    return NextResponse.json({ memory: data });
  },
);
