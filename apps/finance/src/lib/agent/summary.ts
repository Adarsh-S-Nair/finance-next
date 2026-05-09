/**
 * Conversation summarization.
 *
 * Long chats lose context the moment they exceed MAX_PRIOR_MESSAGES —
 * the chat route slices the recent window and silently drops everything
 * before it. This module produces and caches a compact summary of the
 * dropped portion so the model retains the gist (numbers established,
 * decisions reached, pending threads) past the recent-messages cap.
 *
 * Storage: encoded as JSON inside `user_agent_conversations.summary`
 * (existing column, previously unused). Shape is `{ text, message_count }`
 * so we can detect when the cached summary is stale relative to the
 * current backlog. Plain-text rows (legacy or hand-edited) are treated
 * as "no usable summary" and regenerated.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '../supabase/admin';

type AnthropicMessageParam = Anthropic.Messages.MessageParam;
// Input-side block param — covers text, tool_use, AND tool_result. The
// server-side ContentBlock omits tool_result (that's user-emitted),
// which is exactly the block type the message history needs to handle.
type AnthropicContentBlockParam = Anthropic.Messages.ContentBlockParam;

interface StoredSummary {
  text: string;
  message_count: number;
}

function parseStoredSummary(raw: string | null | undefined): StoredSummary | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<StoredSummary>;
    if (typeof parsed.text !== 'string' || typeof parsed.message_count !== 'number') {
      return null;
    }
    return { text: parsed.text, message_count: parsed.message_count };
  } catch {
    return null;
  }
}

/**
 * Render older messages into a compact transcript the summarizer model
 * can read without us having to replay tool_use / tool_result blocks.
 * We collapse:
 *  - text blocks → plain text
 *  - tool_use → `[called <name>(<short input>)]`
 *  - tool_result → `[tool returned: <short output>]`
 *
 * Long blobs are truncated; the goal is a readable timeline, not a
 * faithful replay.
 */
function flattenForSummary(messages: AnthropicMessageParam[]): string {
  const lines: string[] = [];
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    if (typeof msg.content === 'string') {
      if (msg.content.trim()) lines.push(`${role}: ${msg.content.trim()}`);
      continue;
    }
    for (const block of msg.content as AnthropicContentBlockParam[]) {
      if (block.type === 'text') {
        const text = block.text?.trim();
        if (text) lines.push(`${role}: ${text}`);
      } else if (block.type === 'tool_use') {
        const inputJson = JSON.stringify(block.input ?? {});
        const truncated = inputJson.length > 200 ? `${inputJson.slice(0, 200)}…` : inputJson;
        lines.push(`assistant: [called ${block.name}(${truncated})]`);
      } else if (block.type === 'tool_result') {
        // tool_result content can itself be a string or an array of
        // blocks. We only need a short trace, so stringify once.
        const raw =
          typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content ?? '');
        const truncated = raw.length > 300 ? `${raw.slice(0, 300)}…` : raw;
        lines.push(`tool: ${truncated}`);
      }
    }
  }
  return lines.join('\n');
}

const SUMMARIZER_SYSTEM = `You are a summarizer for a personal finance chat between a user and an AI agent. Produce a compact, factual recap of the conversation that another AI agent will read at the top of its next turn so it doesn't repeat questions or contradict prior context.

Cover:
- Concrete facts established (numbers, account names, categories, budget amounts, dates).
- Decisions reached (budgets accepted, recategorizations approved, income set).
- Open threads or pending proposals the user has not yet accepted/declined.
- Anything the user explicitly asked the agent to remember or do later.

Skip:
- Pleasantries, hedging, restatements.
- Tool-call mechanics — only the substantive results matter.
- The most recent few exchanges (those will still be in the live message window).

Output 6-15 short bullet points. No headings, no preamble, no closing line.`;

interface EnsureSummaryArgs {
  client: Anthropic;
  model: string;
  conversationId: string;
  olderMessages: AnthropicMessageParam[];
  // Total count of messages BEFORE the recent window. Used as the
  // staleness key — if it's grown since we last summarized, regenerate.
  olderCount: number;
}

/**
 * Returns the current summary text for `conversationId`, regenerating
 * it via Anthropic if the cached summary is missing or out of date.
 * Returns null if there's nothing to summarize (older window empty).
 */
export async function ensureConversationSummary({
  client,
  model,
  conversationId,
  olderMessages,
  olderCount,
}: EnsureSummaryArgs): Promise<string | null> {
  if (olderCount <= 0 || olderMessages.length === 0) return null;

  const { data: convRow } = await supabaseAdmin
    .from('user_agent_conversations')
    .select('summary')
    .eq('id', conversationId)
    .maybeSingle();

  const cached = parseStoredSummary(convRow?.summary);
  if (cached && cached.message_count >= olderCount) {
    return cached.text;
  }

  // Need to (re)generate. Keep it tight — 800 tokens is plenty for the
  // bullet-point style we ask for, and the cost is amortized across all
  // future turns of this conversation that hit the same summary.
  const transcript = flattenForSummary(olderMessages);
  if (!transcript.trim()) return null;

  const response = await client.messages.create({
    model,
    max_tokens: 800,
    system: SUMMARIZER_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Summarize this earlier conversation:\n\n${transcript}`,
      },
    ],
  });

  const textBlocks = response.content.filter(
    (b): b is Extract<Anthropic.Messages.ContentBlock, { type: 'text' }> =>
      b.type === 'text',
  );
  const text = textBlocks
    .map((b) => b.text)
    .join('\n')
    .trim();
  if (!text) return null;

  const stored: StoredSummary = { text, message_count: olderCount };
  await supabaseAdmin
    .from('user_agent_conversations')
    .update({ summary: JSON.stringify(stored) })
    .eq('id', conversationId);

  return text;
}
