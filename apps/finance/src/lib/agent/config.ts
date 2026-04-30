/**
 * Single source of truth for agent runtime defaults. Keep these in code so
 * the model can be bumped without a migration; the DB column is reserved
 * for per-user customisation (dropdown lands in a follow-up).
 */

export const DEFAULT_AGENT_MODEL = 'claude-sonnet-4-6';

// Cap on how many prior messages we send to the model per turn. Older
// messages stay in the DB but get pruned from the prompt to keep cost
// bounded. When generative UI lands we'll add summarisation; for now a
// hard cap is fine for MVP usage levels.
export const MAX_PRIOR_MESSAGES = 30;

// Cap on the agent's response length per turn (Anthropic max_tokens).
export const MAX_RESPONSE_TOKENS = 2048;

export const SYSTEM_PROMPT = `You are Zervo, a personal finance agent built into the user's Zervo app. You are friendly, concise, and direct — never preachy or moralising about spending. You speak in plain language and avoid finance jargon unless the user uses it first.

You do not yet have access to the user's accounts, transactions, or holdings via tools — that's coming in a follow-up. For now, if asked about specific numbers, say so honestly and suggest the user share what they want to discuss. You can still help with general financial reasoning, budgeting concepts, goal planning, and answering questions.

Never recommend specific securities or give regulated financial advice. You are a helpful assistant, not a licensed advisor.`;
