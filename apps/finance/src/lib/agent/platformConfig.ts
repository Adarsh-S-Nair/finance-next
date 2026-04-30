/**
 * Platform-config reader for the finance chat route. Pulls the active
 * Anthropic API key and Claude model from the `platform_config` table
 * (admin-managed), with env-var fallback so the chat keeps working before
 * an admin has configured anything.
 */
import { decryptPlatformSecret } from '@zervo/supabase';
import { supabaseAdmin } from '../supabase/admin';
import { DEFAULT_AGENT_MODEL } from './config';

const KEY_ANTHROPIC = 'agent.anthropic_api_key';
const KEY_MODEL = 'agent.model';

export type ResolvedAgentConfig = {
  apiKey: string;
  model: string;
  /** Where the API key came from, for log lines. Never include the key itself. */
  source: 'platform_config' | 'env';
};

/**
 * Resolves the API key + model. Throws a clear error if neither the DB
 * nor the env var has a usable key.
 */
export async function resolveAgentConfig(): Promise<ResolvedAgentConfig> {
  const { data: rows } = await supabaseAdmin
    .from('platform_config')
    .select('key, value, is_secret')
    .in('key', [KEY_ANTHROPIC, KEY_MODEL]);

  let dbApiKey: string | null = null;
  let dbModel: string | null = null;

  for (const row of rows ?? []) {
    if (row.key === KEY_ANTHROPIC) {
      try {
        dbApiKey = row.is_secret ? decryptPlatformSecret(row.value) : row.value;
      } catch (err) {
        console.error('[agent:resolveAgentConfig] failed to decrypt API key', err);
      }
    } else if (row.key === KEY_MODEL && typeof row.value === 'string') {
      dbModel = row.value.trim() || null;
    }
  }

  const envApiKey = process.env.ANTHROPIC_API_KEY ?? null;
  const apiKey = dbApiKey || envApiKey;
  if (!apiKey) {
    throw new Error(
      'No Anthropic API key configured. Set agent.anthropic_api_key in admin → Settings → Agent, or set ANTHROPIC_API_KEY env var.',
    );
  }

  return {
    apiKey,
    model: dbModel || DEFAULT_AGENT_MODEL,
    source: dbApiKey ? 'platform_config' : 'env',
  };
}
