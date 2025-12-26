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
      
      // Log account IDs from Plaid response
      if (accounts && accounts.length > 0) {
        console.log('📋 Plaid account IDs:', accounts.map(acc => ({
          account_id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype
        })));
      }
      
      // Log holdings by account
      if (holdings && holdings.length > 0) {
        const holdingsByAcct = {};
        holdings.forEach(h => {
          if (!holdingsByAcct[h.account_id]) {
            holdingsByAcct[h.account_id] = [];
          }
          holdingsByAcct[h.account_id].push({
            security_id: h.security_id,
            quantity: h.quantity,
            institution_value: h.institution_value
          });
        });
        console.log('📦 Holdings by account:', Object.keys(holdingsByAcct).map(accId => ({
          account_id: accId,
          holdings_count: holdingsByAcct[accId].length,
          holdings: holdingsByAcct[accId]
        })));
      }
    }

    logger.info('Holdings data received', {
      accounts_count: accounts?.length || 0,
      holdings_count: holdings?.length || 0,
      securities_count: securities?.length || 0,
      account_ids: accounts?.map(a => a.account_id) || []
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
      
      if (DEBUG) {
        console.log(`📦 Grouped holdings: ${holdingsByAccount.size} accounts have holdings`);
        holdingsByAccount.forEach((accountHoldings, accountId) => {
          console.log(`  Account ${accountId}: ${accountHoldings.length} holdings`);
        });
      }
    }

    let portfoliosCreated = 0;
    let holdingsSynced = 0;
    
    // Create a set of account_ids that have holdings data from Plaid
    const accountIdsWithHoldings = new Set(holdingsByAccount.keys());
    
    // Also get account_ids from Plaid's accounts response (these are all accounts Plaid knows about)
    const plaidAccountIds = new Set();
    if (accounts) {
      accounts.forEach(acc => {
        plaidAccountIds.add(acc.account_id);
      });
    }
    
    if (DEBUG) {
      console.log(`📋 Plaid returned ${accounts?.length || 0} accounts`);
      console.log(`📦 Accounts with holdings from Plaid: ${accountIdsWithHoldings.size}`);
      console.log(`📦 Account IDs from Plaid:`, Array.from(plaidAccountIds));
      console.log(`📦 Account IDs with holdings:`, Array.from(accountIdsWithHoldings));
    }

    // Process accounts that have holdings
    for (const [accountId, accountHoldings] of holdingsByAccount) {
      if (DEBUG) console.log(`🔄 Processing holdings for account: ${accountId} (${accountHoldings.length} holdings)`);
      
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
      
      if (DEBUG) console.log(`✅ Found account in DB: ${account.name} (${account.id})`);

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

        if (DEBUG) {
          console.log(`  📊 Holding: ${ticker.toUpperCase()} - ${quantity} shares @ $${avgCost.toFixed(2)} = $${institutionValue.toFixed(2)}`);
        }

        holdingsToUpsert.push({
          portfolio_id: portfolio.id,
          ticker: ticker.toUpperCase(),
          shares: quantity,
          avg_cost: avgCost,
        });
      });
      
      if (DEBUG) {
        console.log(`  💰 Total holdings value: $${totalHoldingsValue.toFixed(2)}`);
        console.log(`  📝 Holdings to upsert: ${holdingsToUpsert.length}`);
      }

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

      // Delete all existing holdings for this portfolio, then insert new ones
      // This ensures we have exactly what Plaid has (handles removals too)
      const { error: deleteError } = await supabaseAdmin
        .from('holdings')
        .delete()
        .eq('portfolio_id', portfolio.id);

      if (deleteError) {
        logger.error('Error deleting old holdings', null, { portfolio_id: portfolio.id, error: deleteError });
        if (DEBUG) console.log(`  ⚠️ Error deleting old holdings:`, deleteError);
      }

      if (holdingsToUpsert.length > 0) {
        // Only insert non-zero holdings
        const nonZeroHoldings = holdingsToUpsert.filter(h => h.shares > 0);
        
        if (DEBUG) {
          console.log(`  🔍 Filtered holdings: ${holdingsToUpsert.length} total -> ${nonZeroHoldings.length} non-zero`);
          if (holdingsToUpsert.length > nonZeroHoldings.length) {
            const zeroHoldings = holdingsToUpsert.filter(h => h.shares === 0);
            console.log(`  ⚠️ Skipped ${zeroHoldings.length} zero-share holdings:`, zeroHoldings.map(h => h.ticker));
          }
        }

        if (nonZeroHoldings.length > 0) {
          // Insert the new holdings (we already deleted all existing ones above)
          const { error: insertError } = await supabaseAdmin
            .from('holdings')
            .insert(nonZeroHoldings);

          if (insertError) {
            logger.error('Error inserting holdings', null, { portfolio_id: portfolio.id, error: insertError });
            if (DEBUG) console.log(`  ❌ Error inserting holdings:`, insertError);
          } else {
            holdingsSynced += nonZeroHoldings.length;
            if (DEBUG) console.log(`✅ Synced ${nonZeroHoldings.length} holdings for portfolio ${portfolio.id}`);
          }
        } else {
          if (DEBUG) console.log(`  ⚠️ No non-zero holdings to insert for account ${accountId}`);
        }
      } else {
        if (DEBUG) console.log(`  ⚠️ No holdings data from Plaid for account ${accountId} (already deleted old holdings)`);
      }
    }
    
    // Process accounts returned by Plaid that have no holdings
    // (Still create portfolios for them, they just won't have holdings)
    if (accounts && accounts.length > 0) {
      for (const plaidAccount of accounts) {
        // Skip if we already processed this account (it had holdings)
        if (accountIdsWithHoldings.has(plaidAccount.account_id)) {
          continue;
        }
        
        if (DEBUG) console.log(`📋 Processing Plaid account with no holdings: ${plaidAccount.account_id} (${plaidAccount.name})`);
        
        // Find the account in our database
        const { data: account, error: accountError } = await supabaseAdmin
          .from('accounts')
          .select('*')
          .eq('account_id', plaidAccount.account_id)
          .eq('user_id', userId)
          .single();

        if (accountError || !account) {
          if (DEBUG) console.log(`  ⚠️ Account not found in DB: ${plaidAccount.account_id}`);
          continue;
        }
        
        // Skip if this is not an investment account
        if (account.type !== 'investment') {
          if (DEBUG) console.log(`  ⚠️ Account ${plaidAccount.account_id} is not an investment account, skipping`);
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
          const portfolioName = account.name || 'Investment Account';

          const { data: newPortfolio, error: createError } = await supabaseAdmin
            .from('portfolios')
            .insert({
              user_id: userId,
              name: portfolioName,
              type: 'plaid_investment',
              source_account_id: account.id,
              starting_capital: plaidAccount.balances?.current || 0,
              current_cash: plaidAccount.balances?.available || plaidAccount.balances?.current || 0,
            })
            .select()
            .single();

          if (createError) {
            logger.error('Error creating portfolio', null, { account_id: account.id, error: createError });
            if (DEBUG) console.log(`  ❌ Error creating portfolio:`, createError);
          } else {
            portfolio = newPortfolio;
            portfoliosCreated++;
            if (DEBUG) console.log(`✅ Created portfolio ${portfolio.id} for account ${account.id} (${account.name}) - no holdings from Plaid`);
          }
        } else {
          if (DEBUG) console.log(`✅ Portfolio already exists for account ${account.id} (${account.name})`);
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

