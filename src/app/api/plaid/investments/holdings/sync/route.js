import { getPlaidClient } from '../../../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../../../lib/logger';

const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';
const logger = createLogger('holdings-sync');

export async function POST(request) {
  let plaidItemId = null;

  try {
    const { plaidItemId: requestPlaidItemId, userId, forceSync = false } = await request.json();
    plaidItemId = requestPlaidItemId;

    logger.info('Holdings sync request received', {
      plaidItemId,
      userId,
      forceSync
    });
    if (DEBUG) console.log(`🔄 Holdings sync request for plaid item: ${plaidItemId} (user: ${userId})`);

    if (!plaidItemId || !userId) {
      logger.warn('Missing required parameters', { plaidItemId, userId });
      await logger.flush();
      return Response.json(
        { error: 'Plaid item ID and user ID are required' },
        { status: 400 }
      );
    }

    // Get the plaid item from database
    const { data: plaidItem, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .eq('id', plaidItemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !plaidItem) {
      logger.error('Plaid item not found', null, { plaidItemId, userId, error: itemError });
      await logger.flush();
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    logger.info('Plaid item found', { item_id: plaidItem.item_id });
    if (DEBUG) console.log(`📋 Found plaid item: ${plaidItem.item_id}`);

    // Get holdings from Plaid
    const { getInvestmentsHoldings } = await import('../../../../../../lib/plaidClient');
    const holdingsResponse = await getInvestmentsHoldings(plaidItem.access_token);
    
    const { accounts, holdings, securities } = holdingsResponse;
    
    if (DEBUG) {
      console.log(`📊 Received ${holdings?.length || 0} holdings for ${accounts?.length || 0} investment accounts`);
      console.log(`📈 Received ${securities?.length || 0} securities`);
    }

    logger.info('Holdings data received', {
      accounts_count: accounts?.length || 0,
      holdings_count: holdings?.length || 0,
      securities_count: securities?.length || 0
    });

    // Create a map of security_id -> ticker for quick lookup
    const securityMap = new Map();
    if (securities) {
      securities.forEach(security => {
        // Use ticker_symbol if available, otherwise use name or security_id
        const ticker = security.ticker_symbol || security.name || security.security_id;
        securityMap.set(security.security_id, ticker);
      });
    }

    // Create a map of account_id -> account for quick lookup
    const accountMap = new Map();
    if (accounts) {
      accounts.forEach(account => {
        accountMap.set(account.account_id, account);
      });
    }

    // Process holdings: group by account and create/update portfolios and holdings
    const holdingsByAccount = new Map();
    if (holdings) {
      holdings.forEach(holding => {
        if (!holdingsByAccount.has(holding.account_id)) {
          holdingsByAccount.set(holding.account_id, []);
        }
        holdingsByAccount.get(holding.account_id).push(holding);
      });
    }

    let portfoliosCreated = 0;
    let holdingsSynced = 0;

    // Process each account's holdings
    for (const [accountId, accountHoldings] of holdingsByAccount) {
      // Find the account in our database
      const { data: account, error: accountError } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('account_id', accountId)
        .eq('user_id', userId)
        .single();

      if (accountError || !account) {
        logger.warn('Account not found for holdings', { account_id: accountId, error: accountError });
        if (DEBUG) console.log(`⚠️ Account not found: ${accountId}, skipping holdings`);
        continue;
      }

      // Skip if this is not an investment account
      if (account.type !== 'investment') {
        if (DEBUG) console.log(`⚠️ Account ${accountId} is not an investment account, skipping`);
        continue;
      }

      // Find or create portfolio for this account
      let { data: portfolio, error: portfolioError } = await supabaseAdmin
        .from('portfolios')
        .select('*')
        .eq('source_account_id', account.id)
        .eq('type', 'plaid_investment')
        .maybeSingle();

      if (portfolioError) {
        logger.error('Error finding portfolio', null, { account_id: account.id, error: portfolioError });
        continue;
      }

      if (!portfolio) {
        // Portfolio doesn't exist, create it
        const accountData = accountMap.get(accountId);
        const portfolioName = account.name || 'Investment Account';

        const { data: newPortfolio, error: createError } = await supabaseAdmin
          .from('portfolios')
          .insert({
            user_id: userId,
            name: portfolioName,
            type: 'plaid_investment',
            source_account_id: account.id,
            starting_capital: accountData?.balances?.current || 0,
            current_cash: accountData?.balances?.available || accountData?.balances?.current || 0,
          })
          .select()
          .single();

        if (createError) {
          logger.error('Error creating portfolio', null, { account_id: account.id, error: createError });
          continue;
        }

        portfolio = newPortfolio;
        portfoliosCreated++;
        if (DEBUG) console.log(`✅ Created portfolio ${portfolio.id} for account ${account.id}`);
      }

      // Calculate total holdings value and cash
      let totalHoldingsValue = 0;
      const holdingsToUpsert = [];

      accountHoldings.forEach(holding => {
        const ticker = securityMap.get(holding.security_id) || holding.security_id;
        const quantity = parseFloat(holding.quantity) || 0;
        const costBasis = parseFloat(holding.cost_basis) || 0;
        const avgCost = quantity > 0 ? costBasis / quantity : 0;
        const institutionValue = parseFloat(holding.institution_value) || 0;

        totalHoldingsValue += institutionValue;

        holdingsToUpsert.push({
          portfolio_id: portfolio.id,
          ticker: ticker.toUpperCase(),
          shares: quantity,
          avg_cost: avgCost,
        });
      });

      // Update portfolio cash (available balance or current - holdings value)
      const accountData = accountMap.get(accountId);
      const availableCash = accountData?.balances?.available || 0;
      const currentBalance = accountData?.balances?.current || 0;
      // If available is 0 or null, estimate cash as current balance - holdings value
      const estimatedCash = availableCash > 0 ? availableCash : Math.max(0, currentBalance - totalHoldingsValue);

      await supabaseAdmin
        .from('portfolios')
        .update({
          current_cash: estimatedCash,
          updated_at: new Date().toISOString()
        })
        .eq('id', portfolio.id);

      // Upsert holdings (delete all existing and insert new ones for simplicity)
      // This ensures holdings match exactly what Plaid has
      const { error: deleteError } = await supabaseAdmin
        .from('holdings')
        .delete()
        .eq('portfolio_id', portfolio.id);

      if (deleteError) {
        logger.error('Error deleting old holdings', null, { portfolio_id: portfolio.id, error: deleteError });
      }

      if (holdingsToUpsert.length > 0) {
        // Only insert non-zero holdings
        const nonZeroHoldings = holdingsToUpsert.filter(h => h.shares > 0);

        if (nonZeroHoldings.length > 0) {
          const { error: insertError } = await supabaseAdmin
            .from('holdings')
            .insert(nonZeroHoldings);

          if (insertError) {
            logger.error('Error inserting holdings', null, { portfolio_id: portfolio.id, error: insertError });
          } else {
            holdingsSynced += nonZeroHoldings.length;
            if (DEBUG) console.log(`✅ Synced ${nonZeroHoldings.length} holdings for portfolio ${portfolio.id}`);
          }
        }
      }
    }

    logger.info('Holdings sync completed', {
      portfolios_created: portfoliosCreated,
      holdings_synced: holdingsSynced
    });

    return Response.json({
      success: true,
      portfolios_created: portfoliosCreated,
      holdings_synced: holdingsSynced
    });
  } catch (error) {
    logger.error('Error syncing holdings', error, {
      plaidItemId,
      errorMessage: error.message,
      errorStack: error.stack
    });
    await logger.flush();

    return Response.json(
      { error: 'Failed to sync holdings', details: error.message },
      { status: 500 }
    );
  }
}

