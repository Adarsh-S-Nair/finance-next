import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { encryptAgentApiKey } from '../../../../lib/crypto/agentApiKey';
import { ANTHROPIC_KEY_PREFIX, DEFAULT_AGENT_MODEL } from '../../../../lib/agent/config';

/**
 * BYOK profile management.
 *
 * GET    — current user's agent profile, with the API key redacted to
 *          a boolean (`has_api_key`) so we never round-trip the secret.
 * POST   — set or replace the API key + custom instructions. Encrypts
 *          the key before persisting.
 * DELETE — clear the API key (preserves custom_instructions and
 *          conversation history).
 */

export const GET = withAuth('agent:profile:get', async (_req: NextRequest, userId: string) => {
  const { data: profile } = await supabaseAdmin
    .from('user_agent_profile')
    .select('ai_provider, ai_model, ai_api_key_encrypted, custom_instructions, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  return NextResponse.json({
    ai_provider: profile?.ai_provider ?? 'anthropic',
    ai_model: profile?.ai_model ?? DEFAULT_AGENT_MODEL,
    has_api_key: Boolean(profile?.ai_api_key_encrypted),
    custom_instructions: profile?.custom_instructions ?? null,
    updated_at: profile?.updated_at ?? null,
  });
});

interface SaveProfileBody {
  api_key?: string | null;
  custom_instructions?: string | null;
}

export const POST = withAuth('agent:profile:save', async (req: NextRequest, userId: string) => {
  const body = (await req.json().catch(() => ({}))) as SaveProfileBody;

  const updates: {
    user_id: string;
    ai_api_key_encrypted?: string | null;
    custom_instructions?: string | null;
  } = { user_id: userId };

  // Only update the api_key field if the caller actually sent one. This
  // lets the settings page send `custom_instructions` without clobbering
  // an already-stored key.
  if (typeof body.api_key === 'string') {
    const trimmed = body.api_key.trim();
    if (!trimmed) {
      return NextResponse.json({ error: 'api_key cannot be empty' }, { status: 400 });
    }
    if (!trimmed.startsWith(ANTHROPIC_KEY_PREFIX)) {
      return NextResponse.json(
        { error: `Anthropic API keys must start with "${ANTHROPIC_KEY_PREFIX}"` },
        { status: 400 },
      );
    }
    updates.ai_api_key_encrypted = encryptAgentApiKey(trimmed);
  }

  if ('custom_instructions' in body) {
    const ci = body.custom_instructions;
    updates.custom_instructions =
      typeof ci === 'string' && ci.trim().length > 0 ? ci.trim() : null;
  }

  const { error } = await supabaseAdmin
    .from('user_agent_profile')
    .upsert(updates, { onConflict: 'user_id' });

  if (error) {
    console.error('[agent:profile:save] upsert failed', error);
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth('agent:profile:delete-key', async (_req, userId) => {
  const { error } = await supabaseAdmin
    .from('user_agent_profile')
    .update({ ai_api_key_encrypted: null })
    .eq('user_id', userId);

  if (error) {
    console.error('[agent:profile:delete-key] failed', error);
    return NextResponse.json({ error: 'Failed to clear API key' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
});
