import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../../lib/supabase/admin';

/**
 * Returns the user's persistent action on a specific widget instance,
 * if any. Used by widgets on mount to decide whether to render their
 * idle/accepted/declined state — the source of truth is the database,
 * not the in-memory React state.
 *
 * Returns 200 with `{ action: null }` when no action has been taken,
 * which is the common case for a freshly proposed widget. We don't
 * 404 here so the widget client doesn't have to distinguish "no
 * action recorded" from "fetch failed."
 */
export const GET = withAuth<{ toolUseId: string }>(
  'agent:widget-actions:get',
  async (_req: NextRequest, userId: string, { params }) => {
    const { toolUseId } = await params;
    if (!toolUseId) {
      return NextResponse.json(
        { error: 'toolUseId is required' },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from('user_agent_widget_actions')
      .select('action, created_at')
      .eq('user_id', userId)
      .eq('tool_use_id', toolUseId)
      .maybeSingle();

    if (error) {
      console.error('[agent:widget-actions:get] lookup failed', error);
      return NextResponse.json(
        { error: 'Failed to load action' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      action: data?.action ?? null,
      created_at: data?.created_at ?? null,
    });
  },
);
