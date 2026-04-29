import type { NextRequest } from "next/server";
import type { createLogger } from "../logger";
import { syncInvestmentTransactionsForItem } from "./investmentTransactionSync";
import { syncLiabilitiesForItem } from "./liabilitiesSync";

/**
 * Sync runner registry. Each runner takes a uniform context and triggers
 * the post-link sync work for a given Plaid product.
 *
 * Runners are fire-and-forget — they catch their own errors and log them.
 * The exchange-token after() callback iterates over the products attached
 * to a plaid_item and calls each runner; a failure in one shouldn't block
 * the others.
 *
 * Adding a new Plaid product = drop a runner here, register it in the
 * SYNC_RUNNERS map below, and add an entry to ACCOUNT_TYPE_PRODUCTS in
 * productMap.ts. The exchange-token route never has to change.
 */

export type SyncLogger = ReturnType<typeof createLogger>;

export type SyncRunnerContext = {
  plaidItemId: string;
  userId: string;
  logger: SyncLogger;
};

export type SyncRunner = (ctx: SyncRunnerContext) => Promise<void>;

/**
 * Build a NextRequest-shaped object good enough to call a route handler
 * directly (we're not going through the network — we just need an object
 * with `headers` and `json()`).
 */
function buildInternalRequest(userId: string, body: Record<string, unknown>): NextRequest {
  return {
    headers: new Headers({ "x-user-id": userId }),
    json: async () => body,
  } as unknown as NextRequest;
}

const runTransactionsSync: SyncRunner = async ({ plaidItemId, userId, logger }) => {
  try {
    const { POST } = await import("../../app/api/plaid/transactions/sync/route");
    const req = buildInternalRequest(userId, { plaidItemId });
    const res = await POST(req, { params: Promise.resolve({}) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      logger.error("Transaction sync failed after exchange", null, { plaidItemId, body });
      return;
    }
    const result = (await res.json()) as { transactions_synced?: number };
    logger.info("Transaction sync completed after exchange", {
      plaidItemId,
      transactions_synced: result.transactions_synced,
    });
  } catch (err) {
    logger.error("Exception triggering transaction sync", err as Error, { plaidItemId });
  }
};

const runInvestmentsSync: SyncRunner = async ({ plaidItemId, userId, logger }) => {
  // Holdings sync. Failure here is non-fatal — link succeeded, the user
  // just won't see positions until the next webhook or manual sync.
  try {
    const { POST } = await import("../../app/api/plaid/investments/holdings/sync/route");
    const req = buildInternalRequest(userId, { plaidItemId });
    const res = await POST(req, { params: Promise.resolve({}) });
    if (!res.ok) {
      logger.warn("Holdings sync failed after exchange, but account linking succeeded", {
        plaidItemId,
        status: res.status,
      });
    } else {
      const result = (await res.json()) as { holdings_synced?: number };
      logger.info("Holdings sync completed after exchange", {
        plaidItemId,
        holdings_synced: result.holdings_synced,
      });
    }
  } catch (err) {
    logger.error("Exception triggering holdings sync", err as Error, { plaidItemId });
  }

  // Investment transactions — separate sync that pulls trade history.
  try {
    const result = (await syncInvestmentTransactionsForItem({
      plaidItemId,
      userId,
    })) as { transactions_synced?: number };
    logger.info("Investment transactions sync completed after exchange", {
      plaidItemId,
      transactions_synced: result.transactions_synced,
    });
  } catch (err) {
    logger.error("Exception triggering investment transactions sync", err as Error, {
      plaidItemId,
    });
  }
};

const runLiabilitiesSync: SyncRunner = async ({ plaidItemId, userId, logger }) => {
  try {
    const result = await syncLiabilitiesForItem({ plaidItemId, userId });
    logger.info("Liabilities sync completed after exchange", {
      plaidItemId,
      liabilities_synced: result.liabilities_synced,
    });
  } catch (err) {
    logger.error("Exception triggering liabilities sync", err as Error, { plaidItemId });
  }
};

export const SYNC_RUNNERS: Record<string, SyncRunner> = {
  transactions: runTransactionsSync,
  investments: runInvestmentsSync,
  liabilities: runLiabilitiesSync,
};

/**
 * Run every registered sync runner for the given product list, in
 * parallel. Unknown products are silently skipped (logged as a warning so
 * mismatches between productMap and SYNC_RUNNERS don't go unnoticed).
 */
export async function runSyncsForProducts(
  products: string[],
  ctx: SyncRunnerContext,
): Promise<void> {
  await Promise.all(
    products.map(async (product) => {
      const runner = SYNC_RUNNERS[product];
      if (!runner) {
        ctx.logger.warn("No sync runner registered for product", { product });
        return;
      }
      await runner(ctx);
    }),
  );
}
