/**
 * Anthropic Claude API pricing for the in-app agent. Rates are per
 * MILLION tokens. See https://www.anthropic.com/pricing.
 *
 * Cache pricing nuance: 5-minute TTL writes are 1.25× the input rate;
 * 1-hour TTL writes are 2× the input rate. The chat route uses 1h
 * (apps/finance/src/app/api/agent/chat/route.ts), so cache_write_rate
 * here is the 1h figure.
 *
 * If pricing changes, update the table — admin cost numbers update on
 * next page load with no migration required.
 */

export type AgentRates = {
  /** Per million input tokens (uncached). */
  input: number;
  /** Per million tokens read from cache. */
  cache_read: number;
  /** Per million tokens written to cache (1h TTL). */
  cache_write: number;
  /** Per million output tokens. */
  output: number;
};

const RATES: Record<string, AgentRates> = {
  // Haiku 4.5
  "claude-haiku-4-5": { input: 1, cache_read: 0.1, cache_write: 2, output: 5 },
  "claude-haiku-4-5-20251001": {
    input: 1,
    cache_read: 0.1,
    cache_write: 2,
    output: 5,
  },
  // Sonnet 4.6
  "claude-sonnet-4-6": {
    input: 3,
    cache_read: 0.3,
    cache_write: 6,
    output: 15,
  },
  // Opus 4.7 — included for forward compat. Far more expensive; if
  // someone enables this, the admin numbers will reflect it.
  "claude-opus-4-7": {
    input: 15,
    cache_read: 1.5,
    cache_write: 30,
    output: 75,
  },
};

/**
 * Best-effort rate lookup. Falls back to Haiku 4.5 rates for unknown
 * model strings — closest to the current default and avoids
 * silently zeroing out cost lines if a model id renames between us
 * and Anthropic.
 */
export function ratesForModel(model: string): AgentRates {
  return RATES[model] ?? RATES["claude-haiku-4-5"];
}

export type UsageCounters = {
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
};

/** Cost in USD for a usage counter, given the model that produced it. */
export function costForUsage(model: string, u: UsageCounters): number {
  const r = ratesForModel(model);
  return (
    (u.input_tokens * r.input +
      u.cache_read_tokens * r.cache_read +
      u.cache_write_tokens * r.cache_write +
      u.output_tokens * r.output) /
    1_000_000
  );
}

/**
 * Cache hit ratio against the prefix-cacheable bucket
 * (input + cache_read + cache_write). Output tokens aren't cacheable
 * so they don't go in the denominator. Returns null if there's no
 * cacheable activity to measure (avoids 0/0 → NaN).
 */
export function cacheHitRatio(u: UsageCounters): number | null {
  const denom = u.input_tokens + u.cache_read_tokens + u.cache_write_tokens;
  if (denom === 0) return null;
  return u.cache_read_tokens / denom;
}

export function formatUsd(n: number): string {
  // Sub-cent precision for agent cost — typical per-user lifetime
  // values can sit at fractions of a cent during early use, so $0.00
  // would hide useful signal.
  if (n < 0.01) {
    return `$${n.toFixed(4)}`;
  }
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
