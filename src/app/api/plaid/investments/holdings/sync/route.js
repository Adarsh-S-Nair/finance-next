import { getPlaidClient } from '../../../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../../../lib/logger';

const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';
const logger = createLogger('holdings-sync');

// Mapping of crypto ticker symbols to Trust Wallet blockchain chain names for logos
// Trust Wallet assets repo: https://github.com/trustwallet/assets/tree/master/blockchains
const CRYPTO_CHAIN_MAP = {
  'BTC': 'bitcoin',
  'ETH': 'ethereum',
  'SOL': 'solana',
  'DOGE': 'doge',
  'XRP': 'xrp',
  'ADA': 'cardano',
  'DOT': 'polkadot',
  'AVAX': 'avalanchec',
  'MATIC': 'polygon',
  'LINK': 'ethereum', // LINK is on Ethereum
  'ATOM': 'cosmos',
  'LTC': 'litecoin',
  'UNI': 'ethereum', // UNI is on Ethereum
  'SHIB': 'ethereum', // SHIB is on Ethereum
  'PEPE': 'ethereum', // PEPE is on Ethereum
  'TRX': 'tron',
  'BCH': 'bitcoincash',
  'XLM': 'stellar',
  'ALGO': 'algorand',
  'VET': 'vechain',
  'FIL': 'filecoin',
  'NEAR': 'near',
  'APT': 'aptos',
  'ARB': 'arbitrum',
  'OP': 'optimism',
  'INJ': 'injective',
  'SUI': 'sui',
  'SEI': 'sei',
  'TON': 'ton',
  'HBAR': 'hedera',
  'ETC': 'classic',
  'XMR': 'monero',
  'ICP': 'internet-computer',
  'FTM': 'fantom',
  'EGLD': 'elrond',
  'THETA': 'theta',
  'XTZ': 'tezos',
  'EOS': 'eos',
  'AAVE': 'ethereum', // AAVE is on Ethereum
  'MKR': 'ethereum', // MKR is on Ethereum
  'GRT': 'ethereum', // GRT is on Ethereum
  'CRO': 'cronos',
  'QNT': 'ethereum', // QNT is on Ethereum
  'SAND': 'ethereum', // SAND is on Ethereum
  'MANA': 'ethereum', // MANA is on Ethereum
  'AXS': 'ethereum', // AXS is on Ethereum
  'APE': 'ethereum', // APE is on Ethereum
  'LDO': 'ethereum', // LDO is on Ethereum
  'CRV': 'ethereum', // CRV is on Ethereum
  'SNX': 'ethereum', // SNX is on Ethereum
  'COMP': 'ethereum', // COMP is on Ethereum
  '1INCH': 'ethereum', // 1INCH is on Ethereum
  'ENS': 'ethereum', // ENS is on Ethereum
  'BAT': 'ethereum', // BAT is on Ethereum
};

/**
 * Get Trust Wallet logo URL for a crypto ticker
 * @param {string} ticker - Crypto ticker symbol (e.g., 'BTC', 'ETH')
 * @returns {string|null} - Logo URL or null if chain not found
 */
function getCryptoLogoUrl(ticker) {
  const chain = CRYPTO_CHAIN_MAP[ticker.toUpperCase()];
  if (chain) {
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chain}/info/logo.png`;
  }
  return null;
}

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

    // Create a map of security_id -> security info for quick lookup
    // Plaid's security.type can be: cash, cryptocurrency, derivative, equity, etf, fixed income, loan, mutual fund, other
    const securityMap = new Map();
    if (securities) {
      securities.forEach(security => {
        // Use ticker_symbol if available, otherwise use name or security_id
        const ticker = security.ticker_symbol || security.name || security.security_id;
        
        // Determine asset type from Plaid's security type
        const isCrypto = security.type === 'cryptocurrency';
        const isCash = security.type === 'cash' || security.is_cash_equivalent === true;
        
        // Determine the asset_type for our database
        let assetType = 'stock'; // default
        if (isCrypto) assetType = 'crypto';
        else if (isCash) assetType = 'cash';
        
        securityMap.set(security.security_id, {
          ticker,
          type: security.type,
          isCrypto,
          isCash,
          name: security.name,
          assetType
        });
      });
      
      if (DEBUG) {
        const cryptoSecurities = Array.from(securityMap.values()).filter(s => s.isCrypto);
        const cashSecurities = Array.from(securityMap.values()).filter(s => s.isCash);
        const stockSecurities = Array.from(securityMap.values()).filter(s => !s.isCrypto && !s.isCash);
        console.log(`📊 Security types: ${stockSecurities.length} stocks/ETFs, ${cryptoSecurities.length} crypto, ${cashSecurities.length} cash`);
        if (cryptoSecurities.length > 0) {
          console.log(`🪙 Crypto holdings:`, cryptoSecurities.map(s => s.ticker));
        }
        if (cashSecurities.length > 0) {
          console.log(`💵 Cash holdings:`, cashSecurities.map(s => `${s.ticker} (${s.name})`));
        }
      }
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
      let cashFromHoldings = 0; // Cash positions like CUR:USD
      const holdingsToUpsert = [];

      // Use a Map to aggregate holdings by ticker (in case Plaid returns duplicates)
      const holdingsByTicker = new Map();

      // Track which tickers are crypto/cash for later ticker upserts
      const cryptoTickers = new Set();
      const cashTickers = new Set();
      const tickerSecurityInfo = new Map(); // ticker -> security info from Plaid
      
      accountHoldings.forEach(holding => {
        const securityInfo = securityMap.get(holding.security_id) || { ticker: holding.security_id, isCrypto: false, isCash: false, assetType: 'stock' };
        const ticker = securityInfo.ticker || holding.security_id;
        const tickerUpper = ticker.toUpperCase();
        const quantity = parseFloat(holding.quantity) || 0;
        const costBasis = parseFloat(holding.cost_basis) || 0;
        const institutionValue = parseFloat(holding.institution_value) || 0;

        // Check for legacy CUR: prefixed cash positions
        const isLegacyCashFormat = tickerUpper.startsWith('CUR:');
        const isCashHolding = securityInfo.isCash || isLegacyCashFormat;

        // Track cash value for logging purposes
        if (isCashHolding) {
          cashFromHoldings += institutionValue;
        }

        // Track tickers by type
        if (securityInfo.isCrypto) {
          cryptoTickers.add(tickerUpper);
          tickerSecurityInfo.set(tickerUpper, securityInfo);
        } else if (isCashHolding) {
          cashTickers.add(tickerUpper);
          tickerSecurityInfo.set(tickerUpper, { ...securityInfo, isCash: true, assetType: 'cash' });
        } else {
          tickerSecurityInfo.set(tickerUpper, securityInfo);
        }

        totalHoldingsValue += institutionValue;

        // Determine asset_type for the holding
        let holdingAssetType = 'stock';
        if (securityInfo.isCrypto) holdingAssetType = 'crypto';
        else if (isCashHolding) holdingAssetType = 'cash';

        if (DEBUG) {
          const assetLabel = isCashHolding ? '💵 Cash' : (securityInfo.isCrypto ? '🪙 Crypto' : '📊 Stock');
          console.log(`  ${assetLabel}: ${tickerUpper} - ${quantity} shares @ $${costBasis > 0 && quantity > 0 ? (costBasis / quantity).toFixed(2) : '0.00'} = $${institutionValue.toFixed(2)}`);
        }

        // Aggregate holdings by ticker (sum shares, weighted average for cost)
        if (holdingsByTicker.has(tickerUpper)) {
          const existing = holdingsByTicker.get(tickerUpper);
          const totalShares = existing.shares + quantity;
          const totalCostBasis = (existing.avg_cost * existing.shares) + costBasis;
          holdingsByTicker.set(tickerUpper, {
            portfolio_id: portfolio.id,
            ticker: tickerUpper,
            shares: totalShares,
            avg_cost: totalShares > 0 ? totalCostBasis / totalShares : 0,
            asset_type: holdingAssetType,
          });
        } else {
          const avgCost = quantity > 0 ? costBasis / quantity : 0;
          holdingsByTicker.set(tickerUpper, {
            portfolio_id: portfolio.id,
            ticker: tickerUpper,
            shares: quantity,
            avg_cost: avgCost,
            asset_type: holdingAssetType,
          });
        }
      });
      
      if (DEBUG) {
        if (cryptoTickers.size > 0) {
          console.log(`  🪙 Found ${cryptoTickers.size} crypto holdings:`, Array.from(cryptoTickers));
        }
        if (cashTickers.size > 0) {
          console.log(`  💵 Found ${cashTickers.size} cash holdings:`, Array.from(cashTickers));
        }
      }

      // Convert map to array
      holdingsToUpsert.push(...Array.from(holdingsByTicker.values()));

      // Get unique tickers to check/create in database
      const uniqueTickers = Array.from(holdingsByTicker.keys());
      
      // Separate crypto and stock tickers
      const stockTickers = uniqueTickers.filter(t => !cryptoTickers.has(t));
      const cryptoTickersList = uniqueTickers.filter(t => cryptoTickers.has(t));
      
      if (DEBUG) {
        console.log(`  📊 Processing ${stockTickers.length} stock tickers, ${cryptoTickersList.length} crypto tickers, and ${cashTickers.size} cash tickers`);
      }
      
      // Check which tickers exist in database and which are missing data
      const { data: existingTickers, error: tickerCheckError } = await supabaseAdmin
        .from('tickers')
        .select('symbol, name, sector, logo, asset_type')
        .in('symbol', uniqueTickers);

      if (tickerCheckError) {
        logger.warn('Error checking existing tickers', { error: tickerCheckError });
      }

      const existingTickerSymbols = new Set((existingTickers || []).map(t => t.symbol));
      const newTickers = uniqueTickers.filter(t => !existingTickerSymbols.has(t));
      
      // Also find existing tickers that are missing data OR have wrong asset_type
      const existingTickersMissingData = (existingTickers || []).filter(t => {
        const hasName = t.name && t.name.trim() !== '';
        const hasSector = t.sector && t.sector.trim() !== '';
        const hasLogo = t.logo && t.logo.trim() !== '';
        // Check if asset_type is wrong (e.g., crypto marked as stock, or cash marked as stock)
        const isCrypto = cryptoTickers.has(t.symbol);
        const isCash = cashTickers.has(t.symbol);
        let correctAssetType = 'stock';
        if (isCrypto) correctAssetType = 'crypto';
        else if (isCash) correctAssetType = 'cash';
        const hasCorrectAssetType = t.asset_type === correctAssetType;
        return !hasName || !hasSector || !hasLogo || !hasCorrectAssetType;
      }).map(t => t.symbol);
      
      // Combine new tickers and existing tickers missing data
      const tickersToProcess = [...new Set([...newTickers, ...existingTickersMissingData])];
      
      // Split into stock, crypto, and cash for processing
      const stockTickersToProcess = tickersToProcess.filter(t => !cryptoTickers.has(t) && !cashTickers.has(t));
      const cryptoTickersToProcess = tickersToProcess.filter(t => cryptoTickers.has(t));
      const cashTickersToProcess = tickersToProcess.filter(t => cashTickers.has(t));

      // Build map of existing ticker data for preservation
      const existingTickerMap = new Map();
      if (existingTickers) {
        existingTickers.forEach(t => {
          existingTickerMap.set(t.symbol, t);
        });
      }
      
      const logoDevPublicKey = process.env.LOGO_DEV_PUBLIC_KEY;
      const allTickerInserts = [];

      // Process STOCK tickers - fetch details from Finnhub
      if (stockTickersToProcess.length > 0) {
        logger.info('Processing stock tickers', { 
          new: stockTickersToProcess.filter(t => !existingTickerSymbols.has(t)).length, 
          missingData: stockTickersToProcess.filter(t => existingTickerSymbols.has(t)).length,
          total: stockTickersToProcess.length,
          tickers: stockTickersToProcess 
        });
        if (DEBUG) console.log(`  🔍 Processing ${stockTickersToProcess.length} stock tickers:`, stockTickersToProcess);

        // Fetch ticker details from Finnhub (only for stocks)
        const { fetchBulkTickerDetails } = await import('../../../../../../lib/marketData');
        const tickerDetails = await fetchBulkTickerDetails(stockTickersToProcess, 250);

        tickerDetails.forEach(detail => {
          const symbol = detail.ticker.toUpperCase();
          const existingTicker = existingTickerMap.get(symbol);
          
          const name = (existingTicker?.name && existingTicker.name.trim() !== '') 
            ? existingTicker.name 
            : (detail.name || null);
          const sector = (existingTicker?.sector && existingTicker.sector.trim() !== '') 
            ? existingTicker.sector 
            : (detail.sector || null);
          const domain = detail.domain || null;
          
          let logo = null;
          if (existingTicker?.logo && existingTicker.logo.trim() !== '') {
            logo = existingTicker.logo;
          } else if (domain && logoDevPublicKey) {
            logo = `https://img.logo.dev/${domain}?token=${logoDevPublicKey}`;
          }

          allTickerInserts.push({
            symbol: symbol,
            name: name,
            sector: sector,
            logo: logo,
            asset_type: 'stock', // Explicitly set as stock
          });
        });
      }

      // Process CRYPTO tickers - use Plaid's security info and Trust Wallet logos
      if (cryptoTickersToProcess.length > 0) {
        logger.info('Processing crypto tickers', { 
          count: cryptoTickersToProcess.length,
          tickers: cryptoTickersToProcess 
        });
        if (DEBUG) console.log(`  🪙 Processing ${cryptoTickersToProcess.length} crypto tickers:`, cryptoTickersToProcess);

        cryptoTickersToProcess.forEach(ticker => {
          const existingTicker = existingTickerMap.get(ticker);
          const securityInfo = tickerSecurityInfo.get(ticker);
          
          // Use Plaid's security name if available
          const name = (existingTicker?.name && existingTicker.name.trim() !== '') 
            ? existingTicker.name 
            : (securityInfo?.name || ticker);
          
          // Crypto doesn't have a "sector" in the traditional sense
          const sector = (existingTicker?.sector && existingTicker.sector.trim() !== '') 
            ? existingTicker.sector 
            : 'Cryptocurrency';
          
          // Get crypto logo from Trust Wallet assets
          let logo = null;
          if (existingTicker?.logo && existingTicker.logo.trim() !== '') {
            logo = existingTicker.logo;
          } else {
            // Try to get logo from Trust Wallet using our chain mapping
            logo = getCryptoLogoUrl(ticker);
            if (logo && DEBUG) {
              console.log(`  🖼️ Got Trust Wallet logo for ${ticker}: ${logo}`);
            }
          }

          allTickerInserts.push({
            symbol: ticker,
            name: name,
            sector: sector,
            logo: logo,
            asset_type: 'crypto', // Explicitly set as crypto
          });
          
          if (DEBUG) console.log(`  🪙 Crypto ticker: ${ticker} (name: ${name}, logo: ${logo ? 'yes' : 'no'})`);
        });
      }

      // Process CASH tickers - use Plaid's security info
      if (cashTickersToProcess.length > 0) {
        logger.info('Processing cash tickers', { 
          count: cashTickersToProcess.length,
          tickers: cashTickersToProcess 
        });
        if (DEBUG) console.log(`  💵 Processing ${cashTickersToProcess.length} cash tickers:`, cashTickersToProcess);

        cashTickersToProcess.forEach(ticker => {
          const existingTicker = existingTickerMap.get(ticker);
          const securityInfo = tickerSecurityInfo.get(ticker);
          
          // Use Plaid's security name if available
          const name = (existingTicker?.name && existingTicker.name.trim() !== '') 
            ? existingTicker.name 
            : (securityInfo?.name || ticker);
          
          // Cash is its own category
          const sector = (existingTicker?.sector && existingTicker.sector.trim() !== '') 
            ? existingTicker.sector 
            : 'Cash';
          
          // No logo needed for cash
          const logo = (existingTicker?.logo && existingTicker.logo.trim() !== '') 
            ? existingTicker.logo 
            : null;

          allTickerInserts.push({
            symbol: ticker,
            name: name,
            sector: sector,
            logo: logo,
            asset_type: 'cash', // Explicitly set as cash
          });
          
          if (DEBUG) console.log(`  💵 Cash ticker: ${ticker} (name: ${name})`);
        });
      }

      // Upsert all tickers (stocks and crypto)
      if (allTickerInserts.length > 0) {
        const { error: tickerInsertError } = await supabaseAdmin
          .from('tickers')
          .upsert(allTickerInserts, {
            onConflict: 'symbol',
            ignoreDuplicates: false, // Update if exists
          });

        if (tickerInsertError) {
          logger.error('Error upserting tickers', null, { error: tickerInsertError });
          if (DEBUG) console.log(`  ⚠️ Error upserting tickers:`, tickerInsertError);
        } else {
          const stockCount = allTickerInserts.filter(t => t.asset_type === 'stock').length;
          const cryptoCount = allTickerInserts.filter(t => t.asset_type === 'crypto').length;
          const cashCount = allTickerInserts.filter(t => t.asset_type === 'cash').length;
          logger.info('Successfully processed tickers', { total: allTickerInserts.length, stocks: stockCount, crypto: cryptoCount, cash: cashCount });
          if (DEBUG) console.log(`  ✅ Processed ${allTickerInserts.length} tickers (${stockCount} stocks, ${cryptoCount} crypto, ${cashCount} cash)`);
        }
      }
      
      if (DEBUG) {
        console.log(`  💰 Total holdings value: $${totalHoldingsValue.toFixed(2)}`);
        console.log(`  📝 Holdings to upsert: ${holdingsToUpsert.length}`);
      }

      // Note: We no longer update portfolio.current_cash here
      // Account balance (from accounts table) is the source of truth for cash
      // Portfolio value = account balance + holdings value
      if (DEBUG) {
        const accountData = accountMap.get(accountId);
        const currentBalance = accountData?.balances?.current || 0;
        console.log(`  💵 Account balance (source of truth for cash): $${currentBalance.toFixed(2)}`);
        console.log(`  💵 Cash from holdings (CUR:*): $${cashFromHoldings.toFixed(2)}`);
        console.log(`  📊 Holdings value (non-cash): $${totalHoldingsValue.toFixed(2)}`);
        console.log(`  📊 Total portfolio value: $${(currentBalance + totalHoldingsValue).toFixed(2)}`);
      }

      // Delete all existing holdings for this portfolio, then insert new ones
      // This ensures we have exactly what Plaid has (handles removals too)
      // First, check what exists (for debugging)
      const { data: existingHoldingsBeforeDelete, count: existingCount } = await supabaseAdmin
        .from('holdings')
        .select('ticker', { count: 'exact', head: false })
        .eq('portfolio_id', portfolio.id);

      if (DEBUG && existingHoldingsBeforeDelete) {
        console.log(`  🗑️ Found ${existingHoldingsBeforeDelete.length} existing holdings before delete:`, existingHoldingsBeforeDelete.map(h => h.ticker));
      }

      const { error: deleteError, count: deletedCount } = await supabaseAdmin
        .from('holdings')
        .delete({ count: 'exact' })
        .eq('portfolio_id', portfolio.id);

      if (deleteError) {
        logger.error('Error deleting old holdings', null, { portfolio_id: portfolio.id, error: deleteError });
        if (DEBUG) console.log(`  ⚠️ Error deleting old holdings:`, deleteError);
        // Don't continue if delete fails - we'd get duplicate key errors
        continue;
      }

      if (DEBUG) {
        console.log(`  ✅ Deleted ${deletedCount || existingCount || 0} existing holdings for portfolio ${portfolio.id}`);
      }

      // Verify deletion worked
      const { data: remainingHoldings, count: remainingCount } = await supabaseAdmin
        .from('holdings')
        .select('ticker', { count: 'exact', head: false })
        .eq('portfolio_id', portfolio.id);

      if (remainingHoldings && remainingHoldings.length > 0) {
        logger.error('Holdings still exist after delete', null, { 
          portfolio_id: portfolio.id, 
          remaining_count: remainingHoldings.length,
          remaining_tickers: remainingHoldings.map(h => h.ticker)
        });
        if (DEBUG) {
          console.log(`  ⚠️ WARNING: ${remainingHoldings.length} holdings still exist after delete!`, remainingHoldings.map(h => h.ticker));
        }
        // Don't continue - we'd get duplicate key errors
        continue;
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
          // Verify no duplicates in the array we're about to insert
          const tickersToInsert = nonZeroHoldings.map(h => h.ticker);
          const uniqueTickers = new Set(tickersToInsert);
          if (tickersToInsert.length !== uniqueTickers.size) {
            const duplicates = tickersToInsert.filter((t, i) => tickersToInsert.indexOf(t) !== i);
            logger.error('Duplicate tickers found in holdings array', null, {
              portfolio_id: portfolio.id,
              duplicates,
              all_tickers: tickersToInsert
            });
            if (DEBUG) {
              console.log(`  ⚠️ WARNING: Found duplicate tickers in array:`, duplicates);
              console.log(`  📋 All tickers:`, tickersToInsert);
            }
          }

          if (DEBUG) {
            console.log(`  📤 About to insert ${nonZeroHoldings.length} holdings:`, tickersToInsert);
          }

          // Insert the new holdings (we already deleted all existing ones above)
          const { error: insertError } = await supabaseAdmin
            .from('holdings')
            .insert(nonZeroHoldings);

          if (insertError) {
            logger.error('Error inserting holdings', null, { 
              portfolio_id: portfolio.id, 
              error: insertError,
              holdings_count: nonZeroHoldings.length,
              tickers: tickersToInsert
            });
            if (DEBUG) {
              console.log(`  ❌ Error inserting holdings:`, insertError);
              console.log(`  📋 Holdings we tried to insert:`, nonZeroHoldings);
            }
          } else {
            holdingsSynced += nonZeroHoldings.length;
            if (DEBUG) console.log(`✅ Synced ${nonZeroHoldings.length} holdings for portfolio ${portfolio.id}`);

            // Create a snapshot for this portfolio (conditional - only if date/value changed)
            try {
              // Get account balance (source of truth for cash)
              const { data: accountData } = await supabaseAdmin
                .from('accounts')
                .select('balances')
                .eq('id', account.id)
                .single();
              
              const accountBalance = accountData?.balances?.current || 0;
              
              // Fetch current holdings to calculate holdings value
              const { data: currentHoldings } = await supabaseAdmin
                .from('holdings')
                .select('ticker, shares, avg_cost')
                .eq('portfolio_id', portfolio.id);

              // Create snapshot conditionally (only if date changed and value changed)
              const { createPortfolioSnapshotConditional } = await import('../../../../../../lib/portfolioSnapshotUtils');
              const snapshotResult = await createPortfolioSnapshotConditional(
                portfolio.id,
                accountBalance,
                currentHoldings || [],
                {} // No stock quotes available during holdings sync - uses avg_cost
              );

              if (snapshotResult.success && !snapshotResult.skipped) {
                logger.info('Created portfolio snapshot', { 
                  portfolio_id: portfolio.id, 
                  reason: snapshotResult.reason 
                });
                if (DEBUG) console.log(`  📸 Created portfolio snapshot for portfolio ${portfolio.id}: ${snapshotResult.reason}`);
              } else if (snapshotResult.skipped) {
                if (DEBUG) console.log(`  ⏭️ Skipped portfolio snapshot for portfolio ${portfolio.id}: ${snapshotResult.reason}`);
              } else {
                logger.warn('Error creating portfolio snapshot', { 
                  portfolio_id: portfolio.id, 
                  error: snapshotResult.error 
                });
                if (DEBUG) console.log(`  ⚠️ Error creating snapshot:`, snapshotResult.error);
              }
            } catch (snapshotErr) {
              logger.warn('Exception creating portfolio snapshot', { portfolio_id: portfolio.id, error: snapshotErr });
              if (DEBUG) console.log(`  ⚠️ Exception creating snapshot:`, snapshotErr);
              // Don't fail the whole sync if snapshot creation fails
            }
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

