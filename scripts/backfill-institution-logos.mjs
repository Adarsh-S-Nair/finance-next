/**
 * Backfill institution logos for rows where logo IS NULL.
 *
 * For each institution without a logo:
 *   1. Call Plaid's institutionsGetById with include_optional_metadata: true
 *   2. Use Plaid's logo if provided
 *   3. Fall back to logo.dev if Plaid has no logo but the institution has a URL
 *
 * Usage:
 *   node scripts/backfill-institution-logos.mjs
 *
 * Requires .env.prod (loaded automatically).
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ── Load .env.prod ──────────────────────────────────────────────────────────
function loadEnvFile(filename) {
  const envPath = join(rootDir, filename);
  if (!existsSync(envPath)) {
    console.warn(`⚠️  ${filename} not found, skipping`);
    return;
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
  console.log(`✅ Loaded ${filename}`);
}

// Load .env.prod first (Supabase prod creds), then .env.local as fallback for Plaid creds
loadEnvFile('.env.prod');
loadEnvFile('.env.local'); // may contain PLAID_CLIENT_ID / PLAID_SECRET for local dev

// ── Validate env ────────────────────────────────────────────────────────────
const required = [
  'PLAID_CLIENT_ID',
  'PLAID_SECRET',
  'PLAID_ENV',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ── Plaid client ─────────────────────────────────────────────────────────────
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

const plaidEnv = process.env.PLAID_ENV || 'production';
const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});
const plaidClient = new PlaidApi(plaidConfig);

// ── Supabase client ───────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Helpers ───────────────────────────────────────────────────────────────────
async function fetchInstitutionFromPlaid(institutionId) {
  try {
    const response = await plaidClient.institutionsGetById({
      institution_id: institutionId,
      country_codes: ['US'],
      options: { include_optional_metadata: true },
    });
    return response.data.institution;
  } catch (err) {
    const msg = err?.response?.data?.error_message || err.message;
    console.warn(`  ⚠️  Plaid error for ${institutionId}: ${msg}`);
    return null;
  }
}

function logoDevUrl(institutionUrl) {
  const logoDevKey = process.env.LOGO_DEV_PUBLIC_KEY;
  if (!logoDevKey || !institutionUrl) return null;
  try {
    const domain = new URL(institutionUrl).hostname.replace(/^www\./, '');
    if (!domain) return null;
    return `https://img.logo.dev/${domain}?token=${logoDevKey}`;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Fetching institutions with null logos…');

  const { data: institutions, error } = await supabase
    .from('institutions')
    .select('id, institution_id, name, url, logo')
    .is('logo', null);

  if (error) {
    console.error('❌ Failed to fetch institutions:', error);
    process.exit(1);
  }

  if (!institutions || institutions.length === 0) {
    console.log('✅ No institutions with null logos found. Nothing to do.');
    return;
  }

  console.log(`📋 Found ${institutions.length} institution(s) with null logo\n`);

  let updated = 0;
  let skipped = 0;

  for (const inst of institutions) {
    console.log(`🏦 ${inst.name} (${inst.institution_id})`);

    const plaidInst = await fetchInstitutionFromPlaid(inst.institution_id);

    let resolvedLogo = null;

    if (plaidInst?.logo) {
      resolvedLogo = plaidInst.logo;
      console.log(`  ✅ Got logo from Plaid`);
    } else {
      // Try logo.dev fallback using URL from Plaid or existing DB row
      const urlToUse = plaidInst?.url || inst.url;
      resolvedLogo = logoDevUrl(urlToUse);
      if (resolvedLogo) {
        console.log(`  🔗 Using logo.dev fallback: ${resolvedLogo}`);
      } else {
        console.log(`  ℹ️  No logo found (Plaid returned null, no URL for logo.dev)`);
        skipped++;
        continue;
      }
    }

    const { error: updateError } = await supabase
      .from('institutions')
      .update({ logo: resolvedLogo })
      .eq('institution_id', inst.institution_id);

    if (updateError) {
      console.error(`  ❌ Failed to update: ${updateError.message}`);
    } else {
      console.log(`  ✅ Updated logo`);
      updated++;
    }

    // Small delay to avoid hammering Plaid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n🎉 Done! Updated: ${updated}, Skipped (no logo available): ${skipped}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
