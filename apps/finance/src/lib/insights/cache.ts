/**
 * Cache helpers for AI-curated dashboard insights.
 *
 * Two invalidation triggers (whichever fires first):
 *   - TTL: regenerate if `now > expires_at` (~6h default).
 *   - Fingerprint: regenerate if the candidate set changed even within
 *     the TTL window. Catches "user accepted a budget proposal", "new
 *     transactions synced", etc.
 *
 * The fingerprint is computed from each candidate's id + a stable
 * stringification of its context. Sort first so order doesn't affect
 * the hash.
 */
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '../supabase/admin';
import type { Insight, InsightCandidate } from './types';

// 6 hours. Long enough that a normal day of dashboard loads only
// triggers one curator call; short enough that "I accepted that budget
// proposal yesterday, why is my dashboard still showing it?" doesn't
// linger past a sleep cycle.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Stable fingerprint of the candidate set. Two candidate sets that
 * would produce the same curation output should hash to the same value
 * — id + structured context covers it.
 */
export function fingerprintCandidates(candidates: InsightCandidate[]): string {
  const normalized = candidates
    .map((c) => ({ id: c.id, kind: c.kind, context: c.context }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

interface CachedRow {
  insights: Insight[];
  candidate_fingerprint: string;
  expires_at: string;
}

/**
 * Returns the cached insights if (a) a row exists, (b) it hasn't
 * expired, and (c) the candidate fingerprint still matches. Otherwise
 * returns null and the caller re-curates.
 */
export async function getCachedInsights(
  userId: string,
  fingerprint: string,
): Promise<Insight[] | null> {
  const { data } = await supabaseAdmin
    .from('user_agent_insight_cache')
    .select('insights, candidate_fingerprint, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return null;
  const row = data as unknown as CachedRow;
  if (row.candidate_fingerprint !== fingerprint) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (!Array.isArray(row.insights)) return null;

  return row.insights;
}

export async function writeCachedInsights(
  userId: string,
  insights: Insight[],
  fingerprint: string,
  model: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  await supabaseAdmin
    .from('user_agent_insight_cache')
    .upsert(
      {
        user_id: userId,
        insights: insights as unknown as never,
        candidate_fingerprint: fingerprint,
        expires_at: expiresAt,
        model,
      },
      { onConflict: 'user_id' },
    );
}
