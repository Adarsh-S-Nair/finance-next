/**
 * cleanup-free-tier-investment-accounts.js
 *
 * One-time cleanup script to remove investment accounts that were saved for
 * free-tier users before tier-based filtering was introduced (issue #67).
 *
 * Usage:
 *   DRY_RUN=1 node scripts/cleanup-free-tier-investment-accounts.js   # preview
 *   node scripts/cleanup-free-tier-investment-accounts.js              # actually delete
 *
 * Requires environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.env.DRY_RUN === '1';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log(`🔍 Mode: ${DRY_RUN ? 'DRY RUN (no deletions)' : 'LIVE (will delete)'}`);

  // Find all free-tier users
  const { data: freeUsers, error: usersError } = await supabase
    .from('user_profiles')
    .select('id, subscription_tier')
    .or('subscription_tier.eq.free,subscription_tier.is.null');

  if (usersError) {
    console.error('❌ Error fetching free-tier users:', usersError.message);
    process.exit(1);
  }

  console.log(`👤 Found ${freeUsers.length} free-tier user(s)`);

  let totalGhost = 0;
  let totalDeleted = 0;

  for (const user of freeUsers) {
    // Find investment accounts for this user
    const { data: investAccounts, error: accError } = await supabase
      .from('accounts')
      .select('id, name, subtype, plaid_item_id')
      .eq('user_id', user.id)
      .eq('type', 'investment');

    if (accError) {
      console.warn(`⚠️ Error fetching accounts for user ${user.id}:`, accError.message);
      continue;
    }

    if (!investAccounts || investAccounts.length === 0) continue;

    totalGhost += investAccounts.length;
    console.log(`\n🏦 User ${user.id} (${user.subscription_tier || 'free'}): ${investAccounts.length} ghost investment account(s)`);
    investAccounts.forEach(a => console.log(`   - [${a.id}] ${a.name} (${a.subtype})`));

    if (!DRY_RUN) {
      const ids = investAccounts.map(a => a.id);

      // Delete associated holdings and investment transactions first (FK constraint)
      const { error: holdingsErr } = await supabase
        .from('holdings')
        .delete()
        .in('account_id', ids);
      if (holdingsErr) console.warn(`   ⚠️ Error deleting holdings:`, holdingsErr.message);

      const { error: invTxErr } = await supabase
        .from('investment_transactions')
        .delete()
        .in('account_id', ids);
      if (invTxErr) console.warn(`   ⚠️ Error deleting investment transactions:`, invTxErr.message);

      const { error: snapErr } = await supabase
        .from('account_snapshots')
        .delete()
        .in('account_id', ids);
      if (snapErr) console.warn(`   ⚠️ Error deleting account snapshots:`, snapErr.message);

      // Delete the accounts
      const { error: deleteErr } = await supabase
        .from('accounts')
        .delete()
        .in('id', ids);

      if (deleteErr) {
        console.error(`   ❌ Error deleting accounts:`, deleteErr.message);
      } else {
        console.log(`   ✅ Deleted ${ids.length} investment account(s)`);
        totalDeleted += ids.length;
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Ghost investment accounts found: ${totalGhost}`);
  if (DRY_RUN) {
    console.log(`   Would delete: ${totalGhost} (run without DRY_RUN=1 to apply)`);
  } else {
    console.log(`   Deleted: ${totalDeleted}`);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
