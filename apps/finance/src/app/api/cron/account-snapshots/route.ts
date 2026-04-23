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
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { verifyCronSecret } from '../../../../lib/api/cron';
import { createLogger } from '../../../../lib/logger';
import type { TablesInsert } from '../../../../types/database';

const logger = createLogger('cron-account-snapshots');

export const dynamic = 'force-dynamic';

interface SnapshotRecord {
  id: string;
  account_id: string;
  recorded_at: string;
  current_balance?: number | null;
}

function thinBucket(
  snapshots: SnapshotRecord[],
  oldestDate: Date,
  newestDate: Date,
  windowDays: number,
  firstId: string,
  lastId: string
): string[] {
  const bucket = snapshots.filter((s) => {
    const t = new Date(s.recorded_at);
    return t > oldestDate && t <= newestDate;
  });

  if (bucket.length <= 1) return [];

  const toDelete: string[] = [];
  let windowStart: Date | null = null;

  for (const snap of bucket) {
    if (snap.id === firstId || snap.id === lastId) {
      windowStart = new Date(snap.recorded_at);
      continue;
    }

    const t = new Date(snap.recorded_at);

    if (windowStart === null) {
      windowStart = t;
      continue;
    }

    const daysDiff = (t.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < windowDays) {
      toDelete.push(snap.id);
    } else {
      windowStart = t;
    }
  }

  return toDelete;
}

function computeIdsToThin(
  snapshots: SnapshotRecord[],
  firstId: string,
  lastId: string
): string[] {
  if (snapshots.length <= 1) return [];

  const now = new Date();
  const date30 = new Date(now);
  date30.setDate(now.getDate() - 30);
  const date90 = new Date(now);
  date90.setDate(now.getDate() - 90);
  const date365 = new Date(now);
  date365.setDate(now.getDate() - 365);

  return [
    ...thinBucket(snapshots, date90, date30, 3, firstId, lastId),
    ...thinBucket(snapshots, date365, date90, 7, firstId, lastId),
    ...thinBucket(snapshots, new Date(0), date365, 30, firstId, lastId),
  ];
}

export async function GET(request: NextRequest): Promise<Response> {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  try {
    const opId = logger.startOperation('account-snapshots-cron');

    // ── Phase 0: Refresh investment balances from Plaid ──
    try {
      const { data: investmentItems, error: invItemsError } = await supabaseAdmin
        .from('accounts')
        .select('plaid_item_id, user_id')
        .eq('type', 'investment')
        .not('plaid_item_id', 'is', null);

      if (invItemsError) {
        logger.warn('Failed to look up investment items, skipping holdings refresh', {
          error: invItemsError.message,
        });
      } else if (investmentItems && investmentItems.length > 0) {
        const uniqueItems = Array.from(
          new Map(investmentItems.map((r) => [r.plaid_item_id, r])).values()
        );
        logger.info('Refreshing holdings before snapshotting', { count: uniqueItems.length });

        const { POST: holdingsSyncEndpoint } = await import(
          '../../plaid/investments/holdings/sync/route'
        );
        for (const item of uniqueItems) {
          try {
            const syncRequest = {
              headers: { get: () => null },
              json: async () => ({
                plaidItemId: item.plaid_item_id,
                userId: item.user_id,
              }),
            } as unknown as NextRequest;
            const syncResponse = await holdingsSyncEndpoint(syncRequest, {
              params: Promise.resolve({}),
            });
            if (!syncResponse.ok) {
              logger.warn('Holdings sync returned non-ok during cron refresh', {
                plaidItemId: item.plaid_item_id,
                status: syncResponse.status,
              });
            }
          } catch (syncErr) {
            logger.error('Exception during holdings sync in cron refresh', syncErr as Error, {
              plaidItemId: item.plaid_item_id,
            });
          }
        }
      }
    } catch (refreshErr) {
      logger.error(
        'Phase 0 investment refresh crashed, continuing with stale data',
        refreshErr as Error
      );
    }

    // ── Phase 1: Create daily snapshots ──
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, user_id, type, balances');

    if (accountsError) {
      throw new Error(`Failed to fetch accounts: ${accountsError.message}`);
    }

    if (!accounts || accounts.length === 0) {
      logger.info('No accounts found, exiting early');
      logger.endOperation(opId, {
        snapshotsCreated: 0,
        snapshotsSkipped: 0,
        thinned: 0,
      });
      await logger.flush();
      return NextResponse.json({
        success: true,
        message: 'No accounts found',
        snapshotsCreated: 0,
        snapshotsSkipped: 0,
        thinned: 0,
      });
    }

    logger.info('Fetched accounts for snapshotting', { count: accounts.length });

    const accountIds = accounts.map((a) => a.id);

    const { data: recentSnapshots, error: recentError } = await supabaseAdmin
      .from('account_snapshots')
      .select('account_id, current_balance, recorded_at')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: false });

    if (recentError) {
      throw new Error(`Failed to fetch recent snapshots: ${recentError.message}`);
    }

    interface RecentSnap {
      account_id: string;
      current_balance: number | null;
      recorded_at: string;
    }
    const mostRecentByAccount = new Map<string, RecentSnap>();
    for (const snap of (recentSnapshots ?? []) as RecentSnap[]) {
      if (!mostRecentByAccount.has(snap.account_id)) {
        mostRecentByAccount.set(snap.account_id, snap);
      }
    }

    const todayUtc = new Date().toISOString().slice(0, 10);

    const snapshotsToInsert: TablesInsert<'account_snapshots'>[] = [];
    let skippedCount = 0;

    for (const account of accounts) {
      if (account.type === 'investment') {
        skippedCount++;
        continue;
      }

      const balances = (account.balances as {
        available?: number | null;
        current?: number | null;
        limit?: number | null;
        iso_currency_code?: string | null;
      } | null) || {};
      const currentBalance = balances.current ?? null;
      const mostRecent = mostRecentByAccount.get(account.id);

      if (mostRecent) {
        const mostRecentDay = new Date(mostRecent.recorded_at).toISOString().slice(0, 10);
        if (mostRecentDay === todayUtc) {
          skippedCount++;
          continue;
        }

        const prevBalance =
          mostRecent.current_balance !== null
            ? Number(mostRecent.current_balance)
            : null;
        const newBalance = currentBalance !== null ? Number(currentBalance) : null;

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
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('account_snapshots')
        .insert(snapshotsToInsert)
        .select('id');

      if (insertError) {
        throw new Error(`Failed to insert snapshots: ${insertError.message}`);
      }

      createdCount = inserted?.length || 0;
      logger.info('Inserted account snapshots', {
        created: createdCount,
        skipped: skippedCount,
      });
    } else {
      logger.info('No new snapshots needed', { skipped: skippedCount });
    }

    // ── Phase 2: Snapshot thinning ──
    const now = new Date();
    const cutoff30 = new Date(now);
    cutoff30.setDate(now.getDate() - 30);

    const { data: oldSnapshots, error: oldError } = await supabaseAdmin
      .from('account_snapshots')
      .select('id, account_id, recorded_at, current_balance')
      .in('account_id', accountIds)
      .lt('recorded_at', cutoff30.toISOString())
      .order('recorded_at', { ascending: true });

    if (oldError) {
      logger.error('Error fetching old snapshots for thinning, skipping this run', null, {
        error: oldError.message,
      });
    } else if (oldSnapshots && oldSnapshots.length > 0) {
      const { data: latestSnaps, error: latestError } = await supabaseAdmin
        .from('account_snapshots')
        .select('id, account_id, recorded_at')
        .in('account_id', accountIds)
        .order('recorded_at', { ascending: false });

      if (latestError) {
        logger.error('Error fetching latest snapshots for thinning', null, {
          error: latestError.message,
        });
      }

      const latestIdByAccount = new Map<string, string>();
      const firstIdByAccount = new Map<string, string>();

      for (const snap of latestSnaps ?? []) {
        if (!latestIdByAccount.has(snap.account_id)) {
          latestIdByAccount.set(snap.account_id, snap.id);
        }
      }

      const oldByAccount = new Map<string, SnapshotRecord[]>();
      for (const snap of oldSnapshots) {
        if (!oldByAccount.has(snap.account_id)) {
          oldByAccount.set(snap.account_id, []);
          firstIdByAccount.set(snap.account_id, snap.id);
        }
        oldByAccount.get(snap.account_id)!.push(snap);
      }

      const allIdsToDelete: string[] = [];

      for (const [accountId, snaps] of oldByAccount.entries()) {
        const firstId = firstIdByAccount.get(accountId);
        const lastId = latestIdByAccount.get(accountId);

        if (!firstId || !lastId) continue;

        const idsToDelete = computeIdsToThin(snaps, firstId, lastId);
        allIdsToDelete.push(...idsToDelete);
      }

      let deletedTotal = 0;
      if (allIdsToDelete.length > 0) {
        const chunkSize = 500;

        for (let i = 0; i < allIdsToDelete.length; i += chunkSize) {
          const chunk = allIdsToDelete.slice(i, i + chunkSize);
          const { error: deleteError } = await supabaseAdmin
            .from('account_snapshots')
            .delete()
            .in('id', chunk);

          if (deleteError) {
            logger.error('Error deleting thinned-snapshots chunk', null, {
              error: deleteError.message,
              chunkSize: chunk.length,
            });
          } else {
            deletedTotal += chunk.length;
          }
        }

        logger.info('Thinned snapshots', {
          deleted: deletedTotal,
          targeted: allIdsToDelete.length,
        });
      } else {
        logger.info('No snapshots eligible for thinning');
      }

      const thinCount = deletedTotal;
      logger.endOperation(opId, {
        snapshotsCreated: createdCount,
        snapshotsSkipped: skippedCount,
        snapshotsThinned: thinCount,
      });
      await logger.flush();

      return NextResponse.json({
        success: true,
        message: 'Account snapshots cron complete',
        snapshotsCreated: createdCount,
        snapshotsSkipped: skippedCount,
        thinned: thinCount,
      });
    }

    logger.endOperation(opId, {
      snapshotsCreated: createdCount,
      snapshotsSkipped: skippedCount,
      snapshotsThinned: 0,
    });
    await logger.flush();

    return NextResponse.json({
      success: true,
      message: 'Account snapshots cron complete',
      snapshotsCreated: createdCount,
      snapshotsSkipped: skippedCount,
      thinned: 0,
    });
  } catch (error) {
    logger.error('Account snapshots cron job failed', error as Error);
    await logger.flush();
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run account snapshots cron',
      },
      { status: 500 }
    );
  }
}
