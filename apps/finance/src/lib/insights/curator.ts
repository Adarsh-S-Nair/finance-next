/**
 * AI curator for dashboard insights.
 *
 * Generators produce candidates from the user's data — every signal
 * they can find, not just the "interesting" ones. This module is the
 * filter: a single Haiku call looks at all candidates plus the user's
 * memory + profile and picks the 2-3 worth surfacing, rewriting them
 * in plain language.
 *
 * Why split it this way:
 *   - Generators are deterministic and cheap. They emit facts.
 *   - The curator brings judgment. It knows that a mortgage budget at
 *     100% on day 5 is expected (fixed recurring), but a dining
 *     budget at 100% on day 12 is not.
 *   - Numbers in the curated output come from the candidate context,
 *     so the model can't hallucinate dollar amounts. It can pick,
 *     drop, reorder, and rephrase, but it can't invent.
 *
 * Failure mode: if the API call fails or returns garbage, the route
 * falls back to deterministic top-N candidates rendered with their
 * default messages. The dashboard never goes empty because of an LLM
 * outage.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../logger';
import type { Insight, InsightCandidate } from './types';

// Haiku 4.5 — fast, cheap (~$1/$5 per million tokens in/out), and smart
// enough to filter + rewrite a few short signals. The chat agent uses
// Sonnet 4.6; we don't need that level of reasoning for a curate pass.
export const CURATOR_MODEL = 'claude-haiku-4-5-20251001';

// Cap on how many curated insights we surface. The carousel auto-rotates
// every 8s; more than 3 is too many to actually read.
const MAX_SURFACED = 3;

// Cap on candidate input. The curator scales linearly with candidate
// count, but in practice generators emit well under this. Hard cap is
// just a safety net.
const MAX_CANDIDATES = 20;

interface CurateArgs {
  apiKey: string;
  candidates: InsightCandidate[];
  /** Active facts from user_agent_memories — gives the curator context
   *  the data alone can't show ("user has 2 kids", "mortgage paid from
   *  unconnected account"). */
  memories: string[];
  /** Monthly take-home, if known. Lets the curator gauge whether a
   *  $400 swing is meaningful. */
  monthlyIncome: number | null;
  /** First name if known, for slightly warmer phrasing. Optional. */
  firstName: string | null;
}

const CURATOR_SYSTEM = `You are the curator for a dashboard insights carousel in a personal finance app. The user sees this strip the moment they open the dashboard. Your job is to look at deterministically-generated candidate signals about their finances and return the 1-3 that are genuinely worth a human's attention, rewriting them in plain language.

# What to surface vs skip

SKIP these (the most common failure mode is surfacing obvious things):
- Fixed recurring bills (mortgage, rent, insurance, real utilities, loan payments) hitting 100% of their budget early in the month. These are paid in full once a month — that's the calendar working as intended, not a warning. The candidate's context.category_type tells you when a budget falls into this bucket.
- Spending pace differences under ~10% on a partial month. Statistical noise on a small sample.
- Top category being "high" when the absolute dollar amount is small relative to the user's monthly_income.
- Generic upcoming-bills counts when the bills are normal recurring expenses the user already knows about. Only surface upcoming bills if the total is unusually large or they cluster in a way the user might miss.

SURFACE these:
- Variable budgets (dining, shopping, entertainment, travel, personal) tracking ahead of pace — pacing > expected by a meaningful margin with days left.
- Spending pace shifts of 15%+ on a partial month, or 10%+ once you're past the 15th.
- A category spending at 1.5x+ its typical monthly average, especially if it's a discretionary category.
- An upcoming-bills cluster that's notably larger than the user's typical week or includes a bill the user might not be expecting.
- Honest positive observations when warranted ("you're pacing 20% under last month") — but don't manufacture spin.

If nothing is genuinely interesting, return zero insights. An empty carousel beats a noisy one.

# How to write the message

- Conversational, one short sentence. No headings, no bullets.
- Lead with the substance, not the framing ("Dining is pacing 40% over last month with 18 days left", not "Here's an insight: ...").
- Numbers must come from the candidate context. Do not invent figures or percentages.
- Skip pleasantries ("just a heads up", "FYI"). The carousel position already signals this is for them.
- Use the user's first name only if it adds warmth (rare).
- NEVER use em dashes ("—") or spaced hyphens used as dash substitutes ("X - Y"). Use periods, commas, parentheses, or colons. Unspaced hyphens in compounds ("self-driving") and ranges ("$130-180") are fine.
- Keep titles short (2-4 words). The carousel renders title above message.

# Tone

- 'positive' for genuinely good observations (spending less, under budget pace).
- 'negative' for things the user should look at (pace ahead, category spike, large upcoming bills).
- 'neutral' for informational without judgment.

# Output

You will call the \`select_insights\` tool exactly once. The tool takes an array of selected insights, each referencing a candidate.id and providing rewritten title/message/tone. Order the array in priority order — the first element is what the user sees first.`;

const SELECT_INSIGHTS_TOOL: Anthropic.Messages.Tool = {
  name: 'select_insights',
  description:
    'Submit the curated set of insights to surface to the user. ' +
    'Each entry references a candidate by id and provides rewritten ' +
    'title/message/tone. Return zero entries if nothing is worth surfacing.',
  input_schema: {
    type: 'object',
    properties: {
      selected: {
        type: 'array',
        maxItems: MAX_SURFACED,
        description:
          'Curated insights in priority order. First element is shown ' +
          'first in the carousel.',
        items: {
          type: 'object',
          required: ['candidate_id', 'title', 'message', 'tone'],
          properties: {
            candidate_id: {
              type: 'string',
              description:
                'The id of one of the candidates provided in the user message. ' +
                'Must match exactly. Do not invent ids.',
            },
            title: {
              type: 'string',
              description: 'Short title (2-4 words) shown above the message.',
            },
            message: {
              type: 'string',
              description:
                'One short conversational sentence. Numbers must come from ' +
                'the candidate context, not invented.',
            },
            tone: {
              type: 'string',
              enum: ['positive', 'negative', 'neutral'],
            },
          },
        },
      },
    },
    required: ['selected'],
  },
};

interface SelectedItem {
  candidate_id: string;
  title: string;
  message: string;
  tone: 'positive' | 'negative' | 'neutral';
}

function buildUserMessage(args: CurateArgs): string {
  const profileLines: string[] = [];
  if (args.firstName) profileLines.push(`First name: ${args.firstName}`);
  if (args.monthlyIncome && args.monthlyIncome > 0) {
    profileLines.push(
      `Monthly take-home income: $${args.monthlyIncome.toLocaleString('en-US')}`,
    );
  } else {
    profileLines.push('Monthly income: not set');
  }

  const memoriesBlock =
    args.memories.length > 0
      ? `\n\n# What you know about the user\n${args.memories.map((m) => `- ${m}`).join('\n')}`
      : '';

  // Compact JSON of candidates — keeps the prompt small while preserving
  // the structured context fields the model needs to judge relevance.
  const compactCandidates = args.candidates.slice(0, MAX_CANDIDATES).map((c) => ({
    id: c.id,
    kind: c.kind,
    default_title: c.defaultTitle,
    default_message: c.defaultMessage,
    default_tone: c.defaultTone,
    context: c.context,
  }));

  return (
    `# User profile\n${profileLines.join('\n')}` +
    memoriesBlock +
    `\n\n# Candidates (JSON)\n${JSON.stringify(compactCandidates, null, 2)}` +
    `\n\nCall select_insights with the curated set. Up to ${MAX_SURFACED} entries. Zero is a valid answer if nothing is interesting.`
  );
}

/**
 * Run the curator. Returns the curated Insight[] (possibly empty) on
 * success, or null if the call failed or returned malformed output.
 * Caller should fall back to deterministic candidates on null.
 */
export async function curateInsights(args: CurateArgs): Promise<Insight[] | null> {
  const logger = createLogger('insights:curator');

  if (args.candidates.length === 0) return [];

  const candidateById = new Map(args.candidates.map((c) => [c.id, c]));
  const client = new Anthropic({ apiKey: args.apiKey });

  let response: Anthropic.Messages.Message;
  try {
    response = await client.messages.create({
      model: CURATOR_MODEL,
      // Generous cap; tool-use payload for 3 short rewrites is well under this.
      max_tokens: 800,
      system: CURATOR_SYSTEM,
      tools: [SELECT_INSIGHTS_TOOL],
      // Force the model to call our tool — it can't free-text its way out.
      tool_choice: { type: 'tool', name: 'select_insights' },
      messages: [{ role: 'user', content: buildUserMessage(args) }],
    });
  } catch (err) {
    logger.error('curator call failed', err as Error, {
      candidate_count: args.candidates.length,
    });
    return null;
  }

  const toolUse = response.content.find(
    (b): b is Extract<Anthropic.Messages.ContentBlock, { type: 'tool_use' }> =>
      b.type === 'tool_use' && b.name === 'select_insights',
  );
  if (!toolUse) {
    logger.warn('curator returned no tool_use block', {
      stop_reason: response.stop_reason,
    });
    return null;
  }

  // Defensive parse — input is `unknown` from the SDK type.
  const input = toolUse.input as { selected?: SelectedItem[] } | null;
  const selected = Array.isArray(input?.selected) ? input!.selected : [];

  const insights: Insight[] = [];
  let nextPriority = 1;
  for (const item of selected.slice(0, MAX_SURFACED)) {
    const candidate = candidateById.get(item.candidate_id);
    if (!candidate) {
      // Model invented an id. Skip rather than crash; we still get
      // partial value from the other selections.
      logger.warn('curator referenced unknown candidate id', {
        invented_id: item.candidate_id,
      });
      continue;
    }
    const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : candidate.defaultTitle;
    const message = typeof item.message === 'string' && item.message.trim() ? item.message.trim() : candidate.defaultMessage;
    const tone =
      item.tone === 'positive' || item.tone === 'negative' || item.tone === 'neutral'
        ? item.tone
        : candidate.defaultTone;

    insights.push({
      id: candidate.id,
      title,
      message,
      tone,
      priority: nextPriority++,
      ...(candidate.feature ? { feature: candidate.feature } : {}),
      ...(candidate.action ? { action: candidate.action } : {}),
    });
  }

  logger.info('curator complete', {
    candidate_count: args.candidates.length,
    surfaced_count: insights.length,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  });

  return insights;
}

/**
 * Deterministic fallback when the curator can't run (no API key,
 * network failure, malformed response). Sorts by priorityHint then by
 * tone (negative first), takes the top N, and returns Insight[] using
 * each candidate's default copy.
 *
 * This is intentionally identical to the OLD behavior — so a complete
 * curator outage degrades back to today's experience instead of an
 * empty carousel.
 */
export function fallbackInsights(candidates: InsightCandidate[]): Insight[] {
  const toneOrder: Record<'negative' | 'neutral' | 'positive', number> = {
    negative: 0,
    neutral: 1,
    positive: 2,
  };
  const sorted = [...candidates].sort(
    (a, b) =>
      a.priorityHint - b.priorityHint ||
      toneOrder[a.defaultTone] - toneOrder[b.defaultTone],
  );
  return sorted.slice(0, MAX_SURFACED).map((c, i) => ({
    id: c.id,
    title: c.defaultTitle,
    message: c.defaultMessage,
    tone: c.defaultTone,
    priority: i + 1,
    ...(c.feature ? { feature: c.feature } : {}),
    ...(c.action ? { action: c.action } : {}),
  }));
}
