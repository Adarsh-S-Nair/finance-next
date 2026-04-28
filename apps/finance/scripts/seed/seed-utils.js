/**
 * Shared utilities for seed scripts.
 * Loads env from .env.test (if present) and exports a Supabase admin client.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env from one of the local dotfiles, in priority order. We prefer
// .env.test if present (historical), then fall back to .env.local /
// .env.development which is what `next dev` uses. Whichever file is
// found first wins — but later files only fill in missing keys.
const envCandidates = ['.env.test', '.env.local', '.env.development'];
let loadedFrom = null;
for (const candidate of envCandidates) {
  try {
    const content = readFileSync(resolve(process.cwd(), candidate), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [key, ...rest] = trimmed.split('=');
      const value = rest.join('=').trim();
      if (key && !(key in process.env)) {
        process.env[key] = value;
      }
    }
    if (!loadedFrom) loadedFrom = candidate;
  } catch {
    // file not found — try the next candidate
  }
}
if (loadedFrom) {
  console.log(`[seed] Loaded environment from ${loadedFrom}`);
} else {
  console.log('[seed] No .env.* file found, using existing environment variables');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '[seed] ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n' +
    'Copy .env.test.example to .env.test and fill in your test Supabase credentials.'
  );
  process.exit(1);
}

/**
 * Supabase admin client — bypasses RLS.
 * Only use this in seed scripts, never in app code.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Create a test user in Supabase Auth.
 * Returns the created user object.
 */
export async function createTestUser({ email, password, name }) {
  console.log(`[seed] Creating user: ${email}`);

  // Check if user already exists
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const existingUser = existing?.users?.find(u => u.email === email);

  if (existingUser) {
    console.log(`[seed] User ${email} already exists — deleting and recreating`);
    await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (error) {
    throw new Error(`Failed to create user ${email}: ${error.message}`);
  }

  console.log(`[seed] ✓ User created: ${data.user.id}`);
  return data.user;
}

/**
 * Print test credentials to the terminal in a readable format.
 */
export function printCredentials({ scenario, email, password, userId, notes = [] }) {
  console.log('\n' + '='.repeat(60));
  console.log(`🧪 Test User Created — ${scenario}`);
  console.log('='.repeat(60));
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  User ID:  ${userId}`);
  if (notes.length) {
    console.log('\n  Notes:');
    for (const note of notes) {
      console.log(`  • ${note}`);
    }
  }
  console.log('='.repeat(60) + '\n');
}

/**
 * Upsert an institution record. Returns the institution row.
 */
export async function upsertInstitution(institution) {
  const { data, error } = await supabaseAdmin
    .from('institutions')
    .upsert({
      institution_id: institution.institution_id,
      name: institution.name,
      logo: institution.logo || null,
      primary_color: institution.primary_color || null,
      url: institution.url || null,
    }, { onConflict: 'institution_id' })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert institution: ${error.message}`);
  return data;
}

/**
 * Insert a plaid_item record for a user. Returns the plaid_item row.
 */
export async function insertPlaidItem({ userId, itemId, accessToken }) {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .insert({
      user_id: userId,
      item_id: itemId,
      access_token: accessToken,
      sync_status: 'idle',
      transaction_cursor: null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert plaid_item: ${error.message}`);
  return data;
}

/**
 * Insert accounts for a user. Returns array of inserted account rows.
 */
export async function insertAccounts({ userId, plaidItemId, itemId, institutionId, accounts }) {
  const rows = accounts.map(acc => ({
    user_id: userId,
    item_id: itemId,
    plaid_item_id: plaidItemId,
    account_id: acc.account_id,
    name: acc.name,
    mask: acc.mask || null,
    type: acc.type,
    subtype: acc.subtype || null,
    balances: acc.balances,
    access_token: 'mock-access-seeded',
    institution_id: institutionId,
    product_type: acc.type === 'investment' ? 'investments' : 'transactions',
    auto_sync: true,
  }));

  const { data, error } = await supabaseAdmin
    .from('accounts')
    .insert(rows)
    .select();

  if (error) throw new Error(`Failed to insert accounts: ${error.message}`);
  return data;
}

/**
 * Insert transactions for an account.
 *
 * Looks up `system_categories.plaid_category_key` to populate `category_id`
 * from each transaction's `personal_finance_category.detailed`. Without this
 * the dashboard's monthly-overview / spending-earning queries silently
 * exclude rows because their `NOT IN (excludedCategoryIds)` filter rejects
 * NULLs (Postgres tri-valued NOT IN behavior).
 */
export async function insertTransactions(transactions) {
  if (!transactions.length) return;

  const { data: systemCategories } = await supabaseAdmin
    .from('system_categories')
    .select('id, plaid_category_key')
    .not('plaid_category_key', 'is', null);

  const categoryIdByPlaidKey = new Map();
  for (const row of systemCategories ?? []) {
    if (row.plaid_category_key) categoryIdByPlaidKey.set(row.plaid_category_key, row.id);
  }

  const rows = transactions.map(tx => {
    const dt = tx.datetime ? new Date(tx.datetime) : null;
    const dateStr = dt && !Number.isNaN(dt.getTime())
      ? dt.toISOString().slice(0, 10)
      : (tx.date || null);
    const detailedKey = tx.personal_finance_category?.detailed || null;
    const categoryId = detailedKey ? categoryIdByPlaidKey.get(detailedKey) ?? null : null;
    return {
      account_id: tx.accountId, // internal UUID, not Plaid account_id
      plaid_transaction_id: tx.transaction_id,
      description: tx.name,
      amount: tx.amount,
      currency_code: tx.iso_currency_code || 'USD',
      pending: tx.pending || false,
      merchant_name: tx.merchant_name || null,
      icon_url: tx.logo_url || tx.icon_url || null,
      personal_finance_category: tx.personal_finance_category || null,
      category_id: categoryId,
      datetime: tx.datetime || null,
      date: dateStr,
      location: tx.location || null,
      payment_channel: tx.payment_channel || null,
      website: tx.website || null,
      pending_plaid_transaction_id: tx.pending_transaction_id || null,
      transaction_source: 'transactions',
    };
  });

  // Insert in batches to avoid payload size limits
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabaseAdmin.from('transactions').insert(batch);
    if (error) throw new Error(`Failed to insert transactions batch: ${error.message}`);
  }

  console.log(`[seed] ✓ Inserted ${rows.length} transactions`);
}

/**
 * Insert holdings for an investment account.
 */
export async function insertPortfolio({ accountId, name, holdings, securities }) {
  if (holdings.length) {
    const holdingRows = holdings.map(h => {
      const sec = securities.find(s => s.security_id === h.security_id);
      return {
        account_id: accountId,
        ticker: sec?.ticker_symbol || h.security_id,
        shares: h.quantity,
        avg_cost: h.cost_basis ? h.cost_basis / h.quantity : h.institution_price,
      };
    });

    const { error: holdingsError } = await supabaseAdmin.from('holdings').insert(holdingRows);
    if (holdingsError) throw new Error(`Failed to insert holdings: ${holdingsError.message}`);
    console.log(`[seed] ✓ Inserted ${holdingRows.length} holdings for account "${name}"`);
  }
}
