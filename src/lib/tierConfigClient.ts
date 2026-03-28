/**
 * tierConfigClient.ts
 *
 * Client-safe tier/feature helpers.
 * These don't use fs or yaml — they read NEXT_PUBLIC_* env vars that Next.js
 * inlines at build time.
 *
 * Use these in React components and client-side code.
 * Use tierConfig.ts for server-side API routes.
 */

// ---------------------------------------------------------------------------
// Tier feature maps (must match config/tiers.yaml)
// Duplicated here so this module has zero server-only dependencies.
// ---------------------------------------------------------------------------

const TIER_FEATURES: Record<string, Record<string, boolean>> = {
  free: {
    transactions: true,
    budgets: false,
    investments: false,
    recurring: false,
    paper_trading: false,
    arbitrage: false,
    ai_trading: false,
    net_worth_history: true,
  },
  pro: {
    transactions: true,
    budgets: true,
    investments: true,
    recurring: true,
    paper_trading: true,
    arbitrage: true,
    ai_trading: true,
    net_worth_history: true,
  },
};

const TIER_CONNECTIONS: Record<string, number> = {
  free: 1,
  pro: 5,
};

const TIER_PLAID_PRODUCTS: Record<string, string[]> = {
  free: ['transactions'],
  pro: ['transactions', 'investments'],
};

// Feature flags (must match config/features.yaml)
const FEATURE_ENABLED_ENVS: Record<string, string[]> = {
  paper_trading: ['development', 'test'],
  arbitrage: ['development', 'test'],
  ai_trading: ['development', 'test'],
  budgets: ['development', 'test', 'production'],
  investments: ['development', 'test', 'production'],
  recurring: ['development', 'test', 'production'],
  transactions: ['development', 'test', 'production'],
  net_worth_history: ['development', 'test', 'production'],
};

// ---------------------------------------------------------------------------
// Display labels for the upgrade overlay (feature key → human-readable label)
// ---------------------------------------------------------------------------

const FEATURE_LABELS: Record<string, string> = {
  transactions: 'Transaction history',
  budgets: 'Budget tracking',
  investments: 'Investment portfolio tracking',
  recurring: 'Recurring transactions analysis',
  paper_trading: 'Paper trading simulator',
  arbitrage: 'Arbitrage scanner',
  ai_trading: 'AI-powered financial insights',
  net_worth_history: 'Net worth tracking',
};

/** Extra perks not tied to a feature flag (shown on the Pro card). */
const PRO_EXTRAS: string[] = [
  'Priority support',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the display feature list for a tier's upgrade card.
 * Includes the connection count + enabled features with human labels.
 * For pro tier, also includes extra perks like "Priority support".
 */
export function getTierDisplayFeatures(tier: string): string[] {
  const connections = TIER_CONNECTIONS[tier] ?? 0;
  const features: string[] = [
    `${connections} bank connection${connections !== 1 ? 's' : ''}`,
  ];

  const tierFeatures = TIER_FEATURES[tier] ?? {};
  for (const [key, enabled] of Object.entries(tierFeatures)) {
    if (enabled && FEATURE_LABELS[key]) {
      features.push(FEATURE_LABELS[key]);
    }
  }

  if (tier === 'pro') {
    features.push(...PRO_EXTRAS);
  }

  return features;
}

/** Check whether a subscription tier has access to a given feature. */
export function canAccess(tier: string, feature: string): boolean {
  return TIER_FEATURES[tier]?.[feature] === true;
}

/** Get a numeric limit for a tier. */
export function getLimit(tier: string, key: string): number {
  if (key === 'connections') return TIER_CONNECTIONS[tier] ?? 0;
  return 0;
}

/** Get the Plaid products enabled for a tier. */
export function getPlaidProducts(tier: string): string[] {
  return TIER_PLAID_PRODUCTS[tier] ?? ['transactions'];
}

/**
 * Check whether a feature is enabled in the current environment.
 * Uses NEXT_PUBLIC_APP_ENV if set, otherwise NODE_ENV.
 */
export function isFeatureEnabled(feature: string): boolean {
  const enabledEnvs = FEATURE_ENABLED_ENVS[feature];
  if (!enabledEnvs) return false;

  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'production';
  return enabledEnvs.includes(env);
}
