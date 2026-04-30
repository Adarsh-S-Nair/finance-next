import { type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import {
  MAX_PRIOR_MESSAGES,
  MAX_RESPONSE_TOKENS,
  SYSTEM_PROMPT,
} from '../../../../lib/agent/config';
import { resolveAgentConfig } from '../../../../lib/agent/platformConfig';
import type { Json } from '../../../../types/database';

/**
 * Chat turn endpoint.
 *
 * Uses the platform-wide ANTHROPIC_API_KEY env var — every authed user can
 * chat with the agent without configuring anything. We previously had a
 * BYOK design and the `ai_api_key_encrypted` column still exists on
 * user_agent_profile for that future-flexibility, but it is unused.
 *
 * Body: { message: string, conversation_id?: string | null }
 *
 * SSE events:
 *   data: { "type": "meta", "conversation_id": "..." }      (first event)
 *   data: { "type": "delta", "text": "..." }                (n events)
 *   data: { "type": "done" }                                (final)
 *   data: { "type": "error", "message": "..." }             (on failure)
 */

interface ChatBody {
  message?: string;
  conversation_id?: string | null;
}

type StoredContent = { text: string };

function extractText(content: unknown): string {
  if (content && typeof content === 'object' && 'text' in content) {
    const text = (content as { text?: unknown }).text;
    if (typeof text === 'string') return text;
  }
  return '';
}

export const POST = withAuth('agent:chat', async (req: NextRequest, userId: string) => {
  const body = (await req.json().catch(() => ({}))) as ChatBody;
  const userMessage = (body.message ?? '').trim();
  if (!userMessage) {
    return Response.json({ error: 'Message is required' }, { status: 400 });
  }

  let agentConfig: Awaited<ReturnType<typeof resolveAgentConfig>>;
  try {
    agentConfig = await resolveAgentConfig();
  } catch (err) {
    console.error('[agent:chat] config resolution failed', err);
    return Response.json(
      { error: err instanceof Error ? err.message : 'Agent is not configured on the server.' },
      { status: 500 },
    );
  }
  const apiKey = agentConfig.apiKey;

  // 1. Load profile (custom instructions only — model now comes from
  // platform_config). Auto-create a row on first use so future per-user
  // settings have somewhere to live.
  const { data: profile } = await supabaseAdmin
    .from('user_agent_profile')
    .select('custom_instructions')
    .eq('user_id', userId)
    .maybeSingle();
  if (!profile) {
    await supabaseAdmin
      .from('user_agent_profile')
      .upsert({ user_id: userId }, { onConflict: 'user_id' });
  }

  // 2. Resolve or create conversation.
  let conversationId = body.conversation_id ?? null;
  if (conversationId) {
    const { data: existing } = await supabaseAdmin
      .from('user_agent_conversations')
      .select('id, user_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!existing || existing.user_id !== userId) {
      return Response.json({ error: 'Conversation not found' }, { status: 404 });
    }
  } else {
    const { data: created, error: createErr } = await supabaseAdmin
      .from('user_agent_conversations')
      .insert({
        user_id: userId,
        title: userMessage.slice(0, 80),
        last_message_at: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (createErr || !created) {
      console.error('[agent:chat] failed to create conversation', createErr);
      return Response.json({ error: 'Failed to start conversation' }, { status: 500 });
    }
    conversationId = created.id;
  }

  // 3. Persist user message.
  const userContent: StoredContent = { text: userMessage };
  await supabaseAdmin.from('user_agent_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userContent as unknown as Json,
  });

  // 4. Load prior messages (capped) for context.
  const { data: priorRows } = await supabaseAdmin
    .from('user_agent_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  const priorMessages = (priorRows ?? [])
    .filter((row) => row.role === 'user' || row.role === 'assistant')
    .map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: extractText(row.content),
    }))
    .filter((m) => m.content.length > 0);

  const trimmed = priorMessages.slice(-MAX_PRIOR_MESSAGES);

  const systemPrompt = profile?.custom_instructions
    ? `${SYSTEM_PROMPT}\n\nUser's custom instructions:\n${profile.custom_instructions}`
    : SYSTEM_PROMPT;

  const model = agentConfig.model;

  const client = new Anthropic({ apiKey });

  // 5. Stream response.
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: 'meta', conversation_id: conversationId });

      let assistantText = '';
      try {
        const anthropicStream = client.messages.stream({
          model,
          max_tokens: MAX_RESPONSE_TOKENS,
          system: systemPrompt,
          messages: trimmed.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const delta = event.delta.text;
            assistantText += delta;
            send({ type: 'delta', text: delta });
          }
        }

        // 6. Persist assistant message + bump conversation timestamp.
        const assistantContent: StoredContent = { text: assistantText };
        await supabaseAdmin.from('user_agent_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: assistantContent as unknown as Json,
        });
        await supabaseAdmin
          .from('user_agent_conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversationId);

        send({ type: 'done' });
      } catch (err) {
        console.error('[agent:chat] stream error', err);
        const message =
          err instanceof Anthropic.APIError
            ? `Anthropic error: ${err.message}`
            : err instanceof Error
              ? err.message
              : 'Unknown error';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
});
