/**
 * tierConfig.ts
 *
 * Centralized tier gating + feature flags. Data is inlined as TS so this
 * module is safe to import from both server (API routes, webhooks) and
 * client (React components) code — no fs, no yaml.
 *
 * Tier / feature changes require a code change + deploy. That's intentional:
 * pricing rarely shifts and a code push is the simplest audit trail.
 */

import { LIABILITIES_ENABLED } from './plaid/productMap';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierConfig {
  connections: number | 'unlimited';
  features: Record<string, boolean>;
  plaid_products: string[];
}

// ---------------------------------------------------------------------------
// Config data (single source of truth)
// ---------------------------------------------------------------------------

// `liabilities` is gated on Plaid product approval. Including it in
// link-token products before approval causes Plaid to reject token
// creation. See LIABILITIES_ENABLED in lib/plaid/productMap.ts — flip
// PLAID_LIABILITIES_ENABLED=true in the environment once approval lands.
const liabilitiesProducts: string[] = LIABILITIES_ENABLED ? ['liabilities'] : [];

const TIERS: Record<string, TierConfig> = {
  free: {
    connections: 1,
    features: {
      transactions: true,
      budgets: false,
      investments: false,
      recurring: false,
      net_worth_history: true,
    },
    plaid_products: ['transactions', ...liabilitiesProducts],
  },
  pro: {
    connections: 5,
    features: {
      transactions: true,
      budgets: true,
      investments: true,
      recurring: true,
      net_worth_history: true,
    },
    plaid_products: ['transactions', 'investments', ...liabilitiesProducts],
  },
};

const FEATURE_ENABLED_ENVS: Record<string, string[]> = {
  budgets: ['development', 'test', 'production'],
  investments: ['development', 'test', 'production'],
  recurring: ['development', 'test', 'production'],
  transactions: ['development', 'test', 'production'],
  net_worth_history: ['development', 'test', 'production'],
};

const FEATURE_LABELS: Record<string, string> = {
  transactions: 'Transaction history',
  budgets: 'Budget tracking',
  investments: 'Investment portfolio tracking',
  recurring: 'Recurring transactions analysis',
  net_worth_history: 'Net worth tracking',
};

const PRO_EXTRAS: string[] = ['Priority support'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTier(tier: string): TierConfig {
  return TIERS[tier] ?? TIERS['free'];
}

/** Check whether a subscription tier has access to a given feature. */
export function canAccess(tier: string, feature: string): boolean {
  return getTier(tier).features?.[feature] === true;
}

/** Get a numeric/unlimited limit for a tier. */
export function getLimit(tier: string, key: string): number | 'unlimited' {
  const value = (getTier(tier) as unknown as Record<string, unknown>)?.[key];
  if (value === 'unlimited') return 'unlimited';
  if (typeof value === 'number') return value;
  return 0;
}

/** Get the Plaid products enabled for a tier. */
export function getPlaidProducts(tier: string): string[] {
  return getTier(tier).plaid_products ?? ['transactions'];
}

/**
 * Check whether a feature is enabled in the current environment.
 * Uses NEXT_PUBLIC_APP_ENV if set, otherwise NODE_ENV.
 */
export function isFeatureEnabled(feature: string): boolean {
  const enabledEnvs = FEATURE_ENABLED_ENVS[feature];
  if (!enabledEnvs) return false;
  const env =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_ENV) ||
    (typeof process !== 'undefined' && process.env.NODE_ENV) ||
    'production';
  return enabledEnvs.includes(env);
}

/**
 * Build the display feature list for a tier's upgrade card.
 * Includes the connection count + enabled features with human labels.
 * For pro tier, also includes extra perks like "Priority support".
 */
export function getTierDisplayFeatures(tier: string): string[] {
  const cfg = getTier(tier);
  const connections = cfg.connections;
  const connectionLabel =
    connections === 'unlimited'
      ? 'Unlimited bank connections'
      : `${connections} bank connection${connections !== 1 ? 's' : ''}`;

  const features: string[] = [connectionLabel];

  for (const [key, enabled] of Object.entries(cfg.features ?? {})) {
    if (enabled && FEATURE_LABELS[key]) {
      features.push(FEATURE_LABELS[key]);
    }
  }

  if (tier === 'pro') {
    features.push(...PRO_EXTRAS);
  }

  return features;
}
