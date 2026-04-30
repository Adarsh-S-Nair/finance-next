import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { DEFAULT_AGENT_MODEL } from '../../../../lib/agent/config';

/**
 * Agent profile management. The platform-wide ANTHROPIC_API_KEY powers
 * every user, so this endpoint only handles `custom_instructions` (and
 * surfaces the model name for future settings UI).
 */

export const GET = withAuth('agent:profile:get', async (_req: NextRequest, userId: string) => {
  const { data: profile } = await supabaseAdmin
    .from('user_agent_profile')
    .select('ai_provider, ai_model, custom_instructions, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  return NextResponse.json({
    ai_provider: profile?.ai_provider ?? 'anthropic',
    ai_model: profile?.ai_model ?? DEFAULT_AGENT_MODEL,
    custom_instructions: profile?.custom_instructions ?? null,
    updated_at: profile?.updated_at ?? null,
  });
});

interface SaveProfileBody {
  custom_instructions?: string | null;
}

export const POST = withAuth('agent:profile:save', async (req: NextRequest, userId: string) => {
  const body = (await req.json().catch(() => ({}))) as SaveProfileBody;

  if (!('custom_instructions' in body)) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const ci = body.custom_instructions;
  const value = typeof ci === 'string' && ci.trim().length > 0 ? ci.trim() : null;

  const { error } = await supabaseAdmin
    .from('user_agent_profile')
    .upsert(
      { user_id: userId, custom_instructions: value },
      { onConflict: 'user_id' },
    );

  if (error) {
    console.error('[agent:profile:save] upsert failed', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});
