/**
 * One-time backfill: encrypt every plaintext Plaid access_token in Postgres.
 *
 * Historically we stored Plaid access tokens as plaintext in:
 *   - plaid_items.access_token
 *   - accounts.access_token  (denormalized copy of the same value)
 *
 * New code writes the token AES-256-GCM-encrypted (`v1:<iv>:<tag>:<ct>`), but
 * pre-existing rows are still plaintext. This script walks both tables and
 * encrypts anything that doesn't already carry the `v1:` prefix.
 *
 * Safe to run multiple times — rows that already start with `v1:` are
 * skipped. Runs against whichever Supabase project the loaded env points at
 * (production if `.env.prod` is loaded).
 *
 * Usage:
 *   # From apps/finance/
 *   node scripts/encrypt-plaid-tokens.mjs
 *
 * Required env (loaded from .env.prod, then .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - PLAID_TOKEN_ENCRYPTION_KEY  (64 hex chars OR base64 → 32 bytes)
 *
 * Generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// ── Load env ────────────────────────────────────────────────────────────────
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

// Try .env.prod first, then .env.local, then .env.development. First writer
// wins (loadEnvFile guards with `if (!process.env[key])`), so putting the
// most-specific file first keeps expected behavior. Some workspaces keep
// production credentials in .env.development — that's why it's in the list.
loadEnvFile('.env.prod');
loadEnvFile('.env.local');
loadEnvFile('.env.development');

// ── Validate env ────────────────────────────────────────────────────────────
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PLAID_TOKEN_ENCRYPTION_KEY',
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ── Encryption (mirrors src/lib/crypto/plaidTokens.ts) ──────────────────────
const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const VERSION = 'v1';

function loadKey() {
  const raw = process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  let key;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== 32) {
    throw new Error(`PLAID_TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length})`);
  }
  return key;
}

function isEncrypted(stored) {
  return typeof stored === 'string' && stored.startsWith(`${VERSION}:`);
}

function encrypt(plaintext, key) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

// ── Supabase client ─────────────────────────────────────────────────────────
const { createClient } = await import('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// ── Backfill one table ──────────────────────────────────────────────────────
async function backfillTable(tableName, key) {
  console.log(`\n🔍 Scanning ${tableName}…`);
  const { data: rows, error } = await supabase
    .from(tableName)
    .select('id, access_token');

  if (error) {
    console.error(`❌ Failed to read ${tableName}:`, error);
    return { scanned: 0, encrypted: 0, skipped: 0, failed: 0 };
  }
  if (!rows || rows.length === 0) {
    console.log(`  (no rows in ${tableName})`);
    return { scanned: 0, encrypted: 0, skipped: 0, failed: 0 };
  }

  let encrypted = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!row.access_token) {
      // access_token is NOT NULL on both tables, but defense in depth.
      console.warn(`  ⚠️  ${tableName}/${row.id}: access_token is empty, skipping`);
      skipped++;
      continue;
    }
    if (isEncrypted(row.access_token)) {
      skipped++;
      continue;
    }

    const ciphertext = encrypt(row.access_token, key);
    const { error: updateError } = await supabase
      .from(tableName)
      .update({ access_token: ciphertext })
      .eq('id', row.id);

    if (updateError) {
      console.error(`  ❌ ${tableName}/${row.id}: update failed — ${updateError.message}`);
      failed++;
    } else {
      encrypted++;
    }
  }

  console.log(
    `  ${tableName}: scanned ${rows.length}, encrypted ${encrypted}, already-encrypted ${skipped}, failed ${failed}`
  );
  return { scanned: rows.length, encrypted, skipped, failed };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔐 Plaid access-token backfill starting…');
  const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  console.log(`   Supabase: ${supabaseHost}`);

  const key = loadKey();
  console.log(`   Key: ${key.length}-byte key loaded`);

  const plaidItemsResult = await backfillTable('plaid_items', key);
  const accountsResult = await backfillTable('accounts', key);

  const totalFailed = plaidItemsResult.failed + accountsResult.failed;

  console.log('\n─────────────────────────────────────');
  console.log(`Total encrypted: ${plaidItemsResult.encrypted + accountsResult.encrypted}`);
  console.log(`Total already-encrypted: ${plaidItemsResult.skipped + accountsResult.skipped}`);
  console.log(`Total failed: ${totalFailed}`);
  console.log('─────────────────────────────────────');

  if (totalFailed > 0) {
    console.error('❌ Some rows failed to encrypt — investigate before re-running.');
    process.exit(1);
  }

  console.log('✅ Done.');
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
