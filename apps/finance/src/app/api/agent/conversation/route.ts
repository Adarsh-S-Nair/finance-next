import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * Returns the user's most recent conversation + its messages, or an empty
 * placeholder if no conversation exists yet. This is what the chat home
 * loads on mount.
 *
 * For MVP we surface a single conversation thread per user. Multi-thread
 * UI lands in a follow-up; the schema already supports it.
 */
export const GET = withAuth('agent:conversation:latest', async (_req: NextRequest, userId: string) => {
  const { data: conversation } = await supabaseAdmin
    .from('user_agent_conversations')
    .select('id, title, summary, last_message_at, created_at')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!conversation) {
    return NextResponse.json({ conversation: null, messages: [] });
  }

  const { data: messages } = await supabaseAdmin
    .from('user_agent_messages')
    .select('id, role, content, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    conversation,
    messages: messages ?? [],
  });
});
