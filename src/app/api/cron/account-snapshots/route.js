/**
 * Account Snapshots Cron Job
 *
 * Runs daily to snapshot every account balance for every user.
 * Only creates a snapshot if the current balance differs from the most recent one
 * (balance-change-only dedup — date will always differ since cron runs once per day).
 *
 * After creating snapshots, runs thinning logic to keep storage manageable:
 *   < 30 days old  → keep all (daily granularity)
 *   30–90 days old → keep 1 per 3 days
 *   90–365 days old → keep 1 per 7 days
 *   > 1 year old   → keep 1 per 30 days
 *
 * Safety invariants (never violated):
 *   - Never delete the most recent snapshot per account
 *   - Never delete the very first snapshot per account (baseline)
 *   - Within each thinning window, keep the first snapshot (earliest recorded_at)
 *
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/account-snapshots",
 *     "schedule": "30 14 * * *"  // 2:30 PM UTC = 9:30 AM EST daily
 *   }]
 * }
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { verifyCronSecret } from '../../../../lib/api/cron';

// Mark route as dynamic to avoid build-time analysis
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Thinning helpers
// ---------------------------------------------------------------------------

/**
 * Given a list of snapshots (sorted ascending by recorded_at) and an age bucket
 * definition, returns the IDs to DELETE for that bucket.
 *
 * Strategy: divide snapshots in the bucket into windows of `windowDays` days.
 * Within each window keep only the FIRST snapshot; mark the rest for deletion.
 * Safety: never mark the first or last snapshot overall for deletion.
 *
 * @param {Array}  snapshots   - all snapshots for one account, asc by recorded_at
 * @param {Date}   oldestDate  - lower bound (exclusive) for this bucket
 * @param {Date}   newestDate  - upper bound (inclusive) for this bucket
 * @param {number} windowDays  - thinning window size in days
 * @param {string} firstId     - id of the very first snapshot (baseline — never delete)
 * @param {string} lastId      - id of the most recent snapshot (never delete)
 * @returns {string[]} ids to delete
 */
function thinBucket(snapshots, oldestDate, newestDate, windowDays, firstId, lastId) {
  // Filter to this bucket
  const bucket = snapshots.filter(s => {
    const t = new Date(s.recorded_at);
    return t > oldestDate && t <= newestDate;
  });

  if (bucket.length <= 1) return [];

  const toDelete = [];
  let windowStart = null;
  let keepInWindow = null; // id of the snapshot to keep in the current window

  for (const snap of bucket) {
    // Safety: never mark first or last overall
    if (snap.id === firstId || snap.id === lastId) {
      // Starting a new window at this protected point
      windowStart = new Date(snap.recorded_at);
      keepInWindow = snap.id;
      continue;
    }

    const t = new Date(snap.recorded_at);

    if (windowStart === null) {
      // First snapshot in bucket — keep it, start window
      windowStart = t;
      keepInWindow = snap.id;
      continue;
    }

    const daysDiff = (t - windowStart) / (1000 * 60 * 60 * 24);

    if (daysDiff < windowDays) {
      // Same window — this snapshot is a duplicate, mark for deletion
      toDelete.push(snap.id);
    } else {
      // New window — keep this one
      windowStart = t;
      keepInWindow = snap.id;
    }
  }

  return toDelete;
}

/**
 * Compute the set of snapshot IDs to delete for one account.
 *
 * @param {Array}  snapshots - old snapshots for the account (>30 days), sorted asc by recorded_at
 * @param {string} firstId   - id of the absolute first snapshot for the account (baseline)
 * @param {string} lastId    - id of the absolute most recent snapshot for the account
 * @returns {string[]}
 */
function computeIdsToThin(snapshots, firstId, lastId) {
  if (snapshots.length <= 1) return [];

  const now = new Date();
  const date30  = new Date(now); date30.setDate(now.getDate() - 30);
  const date90  = new Date(now); date90.setDate(now.getDate() - 90);
  const date365 = new Date(now); date365.setDate(now.getDate() - 365);

  const ids = [
    // 30–90 days: keep 1 per 3 days
    ...thinBucket(snapshots, date90,  date30,  3,  firstId, lastId),
    // 90–365 days: keep 1 per 7 days
    ...thinBucket(snapshots, date365, date90,  7,  firstId, lastId),
    // > 1 year: keep 1 per 30 days
    ...thinBucket(snapshots, new Date(0), date365, 30, firstId, lastId),
  ];

  return ids;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request) {
  // Verify cron secret (mandatory — refuses to run if CRON_SECRET is unset)
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    console.log('\n📸 ACCOUNT SNAPSHOTS CRON JOB');
    console.log('========================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('========================================\n');

    // ------------------------------------------------------------------
    // Phase 0: Refresh investment balances from Plaid
    //
    // Investment account values only change when holdings sync fires, which
    // normally happens on Plaid's HOLDINGS webhook. To make sure today's
    // snapshot captures the latest value even if the webhook didn't fire,
    // we proactively run the holdings sync for every plaid_item that owns
    // at least one investment account. The sync updates accounts.balances.current
    // (plus writes its own account_snapshots row), so by the time we reach
    // Phase 1, investment balances are fresh.
    // ------------------------------------------------------------------
    try {
      const { data: investmentItems, error: invItemsError } = await supabaseAdmin
        .from('accounts')
        .select('plaid_item_id, user_id')
        .eq('type', 'investment')
        .not('plaid_item_id', 'is', null);

      if (invItemsError) {
        console.warn('⚠️  Failed to look up investment items, skipping holdings refresh:', invItemsError.message);
      } else if (investmentItems && investmentItems.length > 0) {
        const uniqueItems = Array.from(
          new Map(investmentItems.map(r => [r.plaid_item_id, r])).values()
        );
        console.log(`🔄 Refreshing holdings for ${uniqueItems.length} investment plaid_items before snapshotting...`);

        const { POST: holdingsSyncEndpoint } = await import('../../plaid/investments/holdings/sync/route.js');
        for (const item of uniqueItems) {
          try {
            const syncRequest = {
              headers: { get: () => null },
              json: async () => ({ plaidItemId: item.plaid_item_id, userId: item.user_id }),
            };
            const syncResponse = await holdingsSyncEndpoint(syncRequest);
            if (!syncResponse.ok) {
              console.warn(`⚠️  Holdings sync failed for item ${item.plaid_item_id}`);
            }
          } catch (syncErr) {
            console.warn(`⚠️  Exception during holdings sync for item ${item.plaid_item_id}:`, syncErr?.message || syncErr);
          }
        }
      }
    } catch (refreshErr) {
      console.warn('⚠️  Phase 0 investment refresh crashed, continuing with stale data:', refreshErr?.message || refreshErr);
    }

    // ------------------------------------------------------------------
    // Phase 1: Create daily snapshots
    // ------------------------------------------------------------------

    // Fetch all accounts with their current balances (post-refresh) in one query
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id, type, balances');

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      console.log('ℹ️  No accounts found');
      return NextResponse.json({
        success: true,
        message: 'No accounts found',
        snapshotsCreated: 0,
        snapshotsSkipped: 0,
        thinned: 0,
      });
    }

    console.log(`📊 Found ${accounts.length} accounts across all users`);

    const accountIds = accounts.map(a => a.id);

    // Fetch the most recent snapshot for each account in one query
    // We use a subquery approach: fetch all snapshots for these accounts ordered desc,
    // then pick the first per account_id in JS.
    const { data: recentSnapshots, error: recentError } = await supabaseAdmin
      .from('account_snapshots')
      .select('account_id, current_balance, recorded_at')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: false });

    if (recentError) {
      throw new Error(`Failed to fetch recent snapshots: ${recentError.message}`);
    }

    // Build a map of account_id → most recent snapshot
    const mostRecentByAccount = new Map();
    for (const snap of recentSnapshots || []) {
      if (!mostRecentByAccount.has(snap.account_id)) {
        mostRecentByAccount.set(snap.account_id, snap);
      }
    }

    const todayUtc = new Date().toISOString().slice(0, 10);

    // Determine which accounts need a new snapshot
    const snapshotsToInsert = [];
    let skippedCount = 0;

    for (const account of accounts) {
      const balances = account.balances || {};
      const currentBalance = balances.current ?? null;
      const mostRecent = mostRecentByAccount.get(account.id);

      if (mostRecent) {
        // Skip if a snapshot already exists for today (holdings sync may have
        // already written one in Phase 0, or another cron run did earlier today).
        const mostRecentDay = new Date(mostRecent.recorded_at).toISOString().slice(0, 10);
        if (mostRecentDay === todayUtc) {
          skippedCount++;
          continue;
        }

        // Otherwise skip if balance is unchanged vs. the most recent snapshot
        const prevBalance = mostRecent.current_balance !== null
          ? parseFloat(mostRecent.current_balance)
          : null;
        const newBalance = currentBalance !== null ? parseFloat(currentBalance) : null;

        if (prevBalance === newBalance) {
          skippedCount++;
          continue;
        }
      }

      snapshotsToInsert.push({
        account_id: account.id,
        account_type: account.type || null,
        available_balance: balances.available ?? null,
        current_balance: currentBalance,
        limit_balance: balances.limit ?? null,
        currency_code: balances.iso_currency_code || 'USD',
        recorded_at: new Date().toISOString(),
      });
    }

    let createdCount = 0;

    if (snapshotsToInsert.length > 0) {
      console.log(`💾 Inserting ${snapshotsToInsert.length} new snapshots...`);

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('account_snapshots')
        .insert(snapshotsToInsert)
        .select('id');

      if (insertError) {
        throw new Error(`Failed to insert snapshots: ${insertError.message}`);
      }

      createdCount = inserted?.length || 0;
      console.log(`✅ Created ${createdCount} snapshots`);
    } else {
      console.log('ℹ️  No new snapshots needed (all balances unchanged)');
    }

    console.log(`⏭️  Skipped ${skippedCount} accounts (balance unchanged)\n`);

    // ------------------------------------------------------------------
    // Phase 2: Snapshot thinning
    // ------------------------------------------------------------------
    console.log('🧹 Running snapshot thinning...');

    const now = new Date();
    const cutoff365 = new Date(now); cutoff365.setDate(now.getDate() - 365);
    const cutoff90  = new Date(now); cutoff90.setDate(now.getDate() - 90);
    const cutoff30  = new Date(now); cutoff30.setDate(now.getDate() - 30);

    // Fetch all snapshots older than 30 days (those are the candidates for thinning)
    // Only fetch id, account_id, recorded_at to keep payload small
    const { data: oldSnapshots, error: oldError } = await supabaseAdmin
      .from('account_snapshots')
      .select('id, account_id, recorded_at, current_balance')
      .in('account_id', accountIds)
      .lt('recorded_at', cutoff30.toISOString())
      .order('recorded_at', { ascending: true });

    if (oldError) {
      console.error('⚠️  Error fetching old snapshots for thinning:', oldError.message);
      // Non-fatal — skip thinning this run
    } else if (oldSnapshots && oldSnapshots.length > 0) {
      // Also need the first snapshot and latest snapshot per account for safety invariants.
      // "First" snapshots are already in oldSnapshots (they're old).
      // "Latest" snapshot per account: we already have mostRecentByAccount but those don't
      // include ids. Re-fetch just ids for the latest per account.
      const { data: latestSnaps, error: latestError } = await supabaseAdmin
        .from('account_snapshots')
        .select('id, account_id, recorded_at')
        .in('account_id', accountIds)
        .order('recorded_at', { ascending: false });

      if (latestError) {
        console.error('⚠️  Error fetching latest snapshots for thinning:', latestError.message);
      }

      const latestIdByAccount = new Map();
      const firstIdByAccount = new Map();

      for (const snap of latestSnaps || []) {
        if (!latestIdByAccount.has(snap.account_id)) {
          latestIdByAccount.set(snap.account_id, snap.id);
        }
      }

      // First snapshots: group oldSnapshots by account (already sorted asc)
      const oldByAccount = new Map();
      for (const snap of oldSnapshots) {
        if (!oldByAccount.has(snap.account_id)) {
          oldByAccount.set(snap.account_id, []);
          firstIdByAccount.set(snap.account_id, snap.id); // first encountered = oldest
        }
        oldByAccount.get(snap.account_id).push(snap);
      }

      // Compute IDs to delete across all accounts
      const allIdsToDelete = [];

      for (const [accountId, snaps] of oldByAccount.entries()) {
        const firstId = firstIdByAccount.get(accountId);
        const lastId  = latestIdByAccount.get(accountId);

        if (!firstId || !lastId) continue;

        // Build full list for this account (old portion only; recent < 30 days are never thinned)
        const idsToDelete = computeIdsToThin(snaps, firstId, lastId);
        allIdsToDelete.push(...idsToDelete);
      }

      if (allIdsToDelete.length > 0) {
        console.log(`🗑️  Deleting ${allIdsToDelete.length} thinned snapshots...`);

        // Batch deletes in chunks of 500 to avoid URL length limits
        const chunkSize = 500;
        let deletedTotal = 0;

        for (let i = 0; i < allIdsToDelete.length; i += chunkSize) {
          const chunk = allIdsToDelete.slice(i, i + chunkSize);
          const { error: deleteError } = await supabaseAdmin
            .from('account_snapshots')
            .delete()
            .in('id', chunk);

          if (deleteError) {
            console.error(`⚠️  Error deleting chunk: ${deleteError.message}`);
          } else {
            deletedTotal += chunk.length;
          }
        }

        console.log(`✅ Thinned ${deletedTotal} snapshots`);
      } else {
        console.log('ℹ️  No snapshots eligible for thinning');
      }

      const thinCount = allIdsToDelete.length;

      console.log('\n========================================');
      console.log('✅ CRON JOB COMPLETE');
      console.log(`   Snapshots created:  ${createdCount}`);
      console.log(`   Snapshots skipped:  ${skippedCount}`);
      console.log(`   Snapshots thinned:  ${thinCount}`);
      console.log('========================================\n');

      return NextResponse.json({
        success: true,
        message: 'Account snapshots cron complete',
        snapshotsCreated: createdCount,
        snapshotsSkipped: skippedCount,
        thinned: thinCount,
      });
    }

    console.log('\n========================================');
    console.log('✅ CRON JOB COMPLETE');
    console.log(`   Snapshots created:  ${createdCount}`);
    console.log(`   Snapshots skipped:  ${skippedCount}`);
    console.log(`   Snapshots thinned:  0`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      message: 'Account snapshots cron complete',
      snapshotsCreated: createdCount,
      snapshotsSkipped: skippedCount,
      thinned: 0,
    });

  } catch (error) {
    console.error('❌ Account snapshots cron job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run account snapshots cron',
      },
      { status: 500 }
    );
  }
}
