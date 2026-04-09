/**
 * tierConfig.ts
 *
 * Centralized tier gating + feature flags.
 * Loaded once at module initialization from config/tiers.yaml and config/features.yaml.
 * Do NOT import this from client components directly — use the re-exported
 * client-safe helpers in tierConfigClient.ts instead.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TierFeatures {
  [feature: string]: boolean;
}

interface TierConfig {
  connections: number | 'unlimited';
  features: TierFeatures;
  plaid_products: string[];
}

interface TiersConfig {
  tiers: {
    [tier: string]: TierConfig;
  };
}

interface FeatureFlag {
  enabled_envs: string[];
  description?: string;
}

interface FeaturesConfig {
  features: {
    [feature: string]: FeatureFlag;
  };
}

// ---------------------------------------------------------------------------
// Load configs once at module init (build/startup time)
// ---------------------------------------------------------------------------

function loadTiersConfig(): TiersConfig {
  const configPath = path.join(process.cwd(), 'config', 'tiers.yaml');
  const raw = fs.readFileSync(configPath, 'utf8');
  return yaml.load(raw) as TiersConfig;
}

function loadFeaturesConfig(): FeaturesConfig {
  const configPath = path.join(process.cwd(), 'config', 'features.yaml');
  const raw = fs.readFileSync(configPath, 'utf8');
  return yaml.load(raw) as FeaturesConfig;
}

// Loaded once — not on every request
let _tiersConfig: TiersConfig | null = null;
let _featuresConfig: FeaturesConfig | null = null;

function getTiersConfig(): TiersConfig {
  if (!_tiersConfig) {
    _tiersConfig = loadTiersConfig();
  }
  return _tiersConfig;
}

function getFeaturesConfig(): FeaturesConfig {
  if (!_featuresConfig) {
    _featuresConfig = loadFeaturesConfig();
  }
  return _featuresConfig;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Check whether a subscription tier has access to a given feature.
 *
 * @param tier - e.g. 'free' | 'pro'
 * @param feature - e.g. 'budgets' | 'investments' | 'recurring'
 */
export function canAccess(tier: string, feature: string): boolean {
  const config = getTiersConfig();
  const tierConfig = config.tiers[tier] ?? config.tiers['free'];
  return tierConfig?.features?.[feature] === true;
}

/**
 * Get a numeric/unlimited limit for a tier.
 *
 * @param tier - e.g. 'free' | 'pro'
 * @param key - e.g. 'connections'
 */
export function getLimit(tier: string, key: string): number | 'unlimited' {
  const config = getTiersConfig();
  const tierConfig = config.tiers[tier] ?? config.tiers['free'];
  const value = (tierConfig as unknown as Record<string, unknown>)?.[key];
  if (value === 'unlimited') return 'unlimited';
  if (typeof value === 'number') return value;
  return 0;
}

/**
 * Get the Plaid products enabled for a tier.
 *
 * @param tier - e.g. 'free' | 'pro'
 */
export function getPlaidProducts(tier: string): string[] {
  const config = getTiersConfig();
  const tierConfig = config.tiers[tier] ?? config.tiers['free'];
  return tierConfig?.plaid_products ?? ['transactions'];
}

/**
 * Check whether a feature is enabled in the current environment.
 * Uses NEXT_PUBLIC_APP_ENV if set, otherwise falls back to NODE_ENV.
 *
 * NOTE: This reads process.env at call time so it works both server-side and
 * during Next.js build/static analysis. On the client, Next.js inlines
 * NEXT_PUBLIC_* env vars at build time.
 *
 * @param feature - e.g. 'budgets' | 'investments' | 'recurring'
 */
export function isFeatureEnabled(feature: string): boolean {
  const config = getFeaturesConfig();
  const flagConfig = config.features[feature];
  if (!flagConfig) return false;

  const env =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_ENV) ||
    (typeof process !== 'undefined' && process.env.NODE_ENV) ||
    'production';

  return flagConfig.enabled_envs.includes(env);
}
