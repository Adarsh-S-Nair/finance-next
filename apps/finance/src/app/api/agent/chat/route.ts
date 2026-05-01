import { type NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import {
  MAX_PRIOR_MESSAGES,
  MAX_RESPONSE_TOKENS,
  MAX_TOOL_ITERATIONS,
  SYSTEM_PROMPT,
} from '../../../../lib/agent/config';
import { resolveAgentConfig } from '../../../../lib/agent/platformConfig';
import { TOOLS, executeTool } from '../../../../lib/agent/tools';
import type { Json } from '../../../../types/database';

/**
 * Chat turn endpoint with tool-use round-trip.
 *
 * High-level loop:
 *   1. Persist the user message.
 *   2. Load conversation history, convert to Anthropic shape.
 *   3. Stream model response. If it ends with `tool_use` blocks:
 *        a. Persist the assistant turn (text + tool_use blocks).
 *        b. Execute each tool, stream `tool_result` events to client.
 *        c. Persist the tool-result turn.
 *        d. Loop up to MAX_TOOL_ITERATIONS.
 *   4. When the model emits `end_turn`, persist final assistant turn.
 *
 * SSE events:
 *   { type: 'meta',         conversation_id }                           — once at start
 *   { type: 'text_delta',   text }                                      — n × per text block
 *   { type: 'tool_use',     id, name, input }                            — when model decides to call a tool
 *   { type: 'tool_result',  tool_use_id, name, output, is_error }        — when result is ready
 *   { type: 'done' }                                                     — final
 *   { type: 'error',        message }                                    — on failure
 */

interface ChatBody {
  message?: string;
  conversation_id?: string | null;
}

type AnthropicContentBlock = Anthropic.Messages.ContentBlock;
type AnthropicMessageParam = Anthropic.Messages.MessageParam;

type StoredContent = {
  text?: unknown;
  blocks?: unknown;
};

// ──────────────────────────────────────────────────────────────────────────
// Persistence helpers
// ──────────────────────────────────────────────────────────────────────────

async function insertMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'tool',
  content: Json,
) {
  await supabaseAdmin.from('user_agent_messages').insert({
    conversation_id: conversationId,
    role,
    content,
  });
}

// Convert a stored row's content into the Anthropic message-param shape.
// Returns null if there's nothing meaningful to send (empty text, empty
// blocks). Caller filters those out.
function rowToAnthropicMessage(row: {
  role: string;
  content: unknown;
}): AnthropicMessageParam | null {
  const stored = (row.content ?? {}) as StoredContent;

  // Normalize role: our 'tool' rows are tool-result content blocks, which
  // Anthropic models as a 'user' message with `tool_result` content blocks.
  const role: 'user' | 'assistant' =
    row.role === 'assistant' ? 'assistant' : 'user';

  if (typeof stored.text === 'string' && stored.text.length > 0) {
    return { role, content: stored.text };
  }

  if (Array.isArray(stored.blocks) && stored.blocks.length > 0) {
    // The blocks array is already in Anthropic content-block shape.
    // Cast through unknown — Anthropic's typing is broad enough that this
    // is safe at runtime so long as we only ever wrote validated blocks.
    return {
      role,
      content: stored.blocks as unknown as AnthropicMessageParam['content'],
    };
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// Route
// ──────────────────────────────────────────────────────────────────────────

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

  // Load profile (for custom_instructions). Auto-create if missing.
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

  // Resolve / create conversation.
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

  // Persist the user message.
  await insertMessage(conversationId, 'user', { text: userMessage } as unknown as Json);

  const systemPrompt = profile?.custom_instructions
    ? `${SYSTEM_PROMPT}\n\nUser's custom instructions:\n${profile.custom_instructions}`
    : SYSTEM_PROMPT;

  const client = new Anthropic({ apiKey: agentConfig.apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: 'meta', conversation_id: conversationId });

      try {
        // Multi-iteration tool-use loop. Each iteration:
        //   - Loads current conversation history from DB.
        //   - Streams a model response.
        //   - If model emits `tool_use` blocks, executes them, stores
        //     results, and loops. Otherwise breaks.
        for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
          // Re-load message history each iteration so we pick up the rows
          // we just inserted (assistant turn + tool result turn).
          const { data: rows } = await supabaseAdmin
            .from('user_agent_messages')
            .select('role, content, created_at')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

          const history: AnthropicMessageParam[] = (rows ?? [])
            .map((r) => rowToAnthropicMessage({ role: r.role, content: r.content }))
            .filter((m): m is AnthropicMessageParam => m !== null);

          const trimmed = history.slice(-MAX_PRIOR_MESSAGES);

          const anthropicStream = client.messages.stream({
            model: agentConfig.model,
            max_tokens: MAX_RESPONSE_TOKENS,
            system: systemPrompt,
            tools: TOOLS,
            messages: trimmed,
          });

          // Stream text deltas + tool_use starts to client. Tool input
          // arrives as JSON deltas inside content_block_delta of type
          // input_json_delta — for simplicity we don't stream those
          // through; we just capture the final input from finalMessage().
          for await (const event of anthropicStream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              send({ type: 'text_delta', text: event.delta.text });
            }
          }

          const finalMessage = await anthropicStream.finalMessage();
          const blocks = finalMessage.content as AnthropicContentBlock[];

          // Persist the assistant turn (raw blocks).
          await insertMessage(conversationId, 'assistant', {
            blocks,
          } as unknown as Json);

          // Find any tool_use blocks the model emitted.
          const toolUses = blocks.filter(
            (b): b is Extract<AnthropicContentBlock, { type: 'tool_use' }> =>
              b.type === 'tool_use',
          );

          if (
            toolUses.length === 0 ||
            finalMessage.stop_reason === 'end_turn' ||
            finalMessage.stop_reason === 'stop_sequence'
          ) {
            // Done — model gave a final answer with no more tool calls.
            break;
          }

          // Notify client of each tool_use so it can render a "Looking up…"
          // placeholder before the result lands.
          for (const tu of toolUses) {
            send({
              type: 'tool_use',
              id: tu.id,
              name: tu.name,
              input: tu.input,
            });
          }

          // Execute each tool in parallel. Results are JSONified into
          // tool_result blocks for the next iteration.
          const toolResultBlocks = await Promise.all(
            toolUses.map(async (tu) => {
              const output = await executeTool(tu.name, tu.input, userId);
              const isError =
                typeof output === 'object' &&
                output !== null &&
                'error' in (output as Record<string, unknown>);

              send({
                type: 'tool_result',
                tool_use_id: tu.id,
                name: tu.name,
                output,
                is_error: isError,
              });

              return {
                type: 'tool_result' as const,
                tool_use_id: tu.id,
                content: JSON.stringify(output),
                ...(isError ? { is_error: true } : {}),
              };
            }),
          );

          // Persist the tool-result turn (Anthropic models this as a user
          // message in the next iteration; our 'tool' role serves the
          // same purpose with clearer DB intent).
          await insertMessage(conversationId, 'tool', {
            blocks: toolResultBlocks,
          } as unknown as Json);
        }

        // Bump the conversation's last_message_at so the switcher list
        // keeps it at the top.
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
