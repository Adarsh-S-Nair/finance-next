import { supabaseAdmin } from './supabaseAdmin';
import { calculatePortfolioValue, formatDateString } from './portfolioUtils';

/**
 * Gets the most recent portfolio snapshot for a given portfolio
 * @param {string} portfolioId - Portfolio ID
 * @returns {Promise<Object|null>} - Most recent snapshot or null if none exists
 */
export async function getMostRecentPortfolioSnapshot(portfolioId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('portfolio_snapshots')
      .select('*')
      .eq('portfolio_id', portfolioId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching most recent portfolio snapshot:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getMostRecentPortfolioSnapshot:', error);
    return null;
  }
}

/**
 * Checks if a new portfolio snapshot should be created based on date and value conditions
 * @param {string} portfolioId - Portfolio ID
 * @param {number} currentTotalValue - Current total portfolio value (account balance + holdings value)
 * @param {number} accountBalance - Current account balance (source of truth for cash)
 * @param {number} holdingsValue - Current holdings value
 * @returns {Promise<Object>} - Result object with shouldCreate flag and reason
 */
export async function shouldCreatePortfolioSnapshot(portfolioId, currentTotalValue, accountBalance, holdingsValue) {
  try {
    // Use formatDateString to get local date (not UTC) to avoid timezone issues
    const currentDate = formatDateString(new Date()); // Get YYYY-MM-DD format (local time)
    
    // Get the most recent snapshot
    const mostRecentSnapshot = await getMostRecentPortfolioSnapshot(portfolioId);
    
    // If no previous snapshot exists, we should create one
    if (!mostRecentSnapshot) {
      return {
        shouldCreate: true,
        reason: 'No previous snapshot exists'
      };
    }
    
    // Check if the date is different
    const mostRecentDate = mostRecentSnapshot.snapshot_date;
    const isDateDifferent = currentDate !== mostRecentDate;
    
    // Check if the total value is different
    const mostRecentValue = parseFloat(mostRecentSnapshot.total_value) || 0;
    const isValueDifferent = Math.abs(currentTotalValue - mostRecentValue) > 0.01; // Allow small floating point differences
    
    // Both conditions must be met
    const shouldCreate = isDateDifferent && isValueDifferent;
    
    return {
      shouldCreate,
      reason: shouldCreate 
        ? `Date different (${currentDate} vs ${mostRecentDate}) and value different ($${currentTotalValue.toFixed(2)} vs $${mostRecentValue.toFixed(2)})`
        : `Conditions not met - Date same: ${!isDateDifferent}, Value same: ${!isValueDifferent}`,
      isDateDifferent,
      isValueDifferent,
      currentDate,
      mostRecentDate,
      currentTotalValue,
      mostRecentValue
    };
  } catch (error) {
    console.error('Error in shouldCreatePortfolioSnapshot:', error);
    return {
      shouldCreate: false,
      reason: `Error checking conditions: ${error.message}`
    };
  }
}

/**
 * Creates a portfolio snapshot with conditional logic
 * @param {string} portfolioId - Portfolio ID
 * @param {number} accountBalance - Account balance (source of truth for cash)
 * @param {Array} holdings - Array of holdings with { ticker, shares, avg_cost }
 * @param {Object} stockQuotes - Map of ticker to { price } (optional, for current market prices)
 * @returns {Promise<Object>} - Result object with success status and data/error
 */
export async function createPortfolioSnapshotConditional(portfolioId, accountBalance, holdings = [], stockQuotes = {}) {
  try {
    // Calculate current portfolio value
    const { totalValue, holdingsValue } = calculatePortfolioValue(accountBalance, holdings, stockQuotes);
    
    // Check if we should create a snapshot
    const shouldCreateResult = await shouldCreatePortfolioSnapshot(portfolioId, totalValue, accountBalance, holdingsValue);
    
    if (!shouldCreateResult.shouldCreate) {
      return {
        success: true,
        skipped: true,
        reason: shouldCreateResult.reason,
        data: null
      };
    }
    
    // Create the snapshot
    // Use formatDateString to get local date (not UTC) to avoid timezone issues
    const snapshotDate = formatDateString(new Date()); // YYYY-MM-DD (local time)
    
    const snapshotData = {
      portfolio_id: portfolioId,
      total_value: totalValue,
      cash: accountBalance,
      holdings_value: holdingsValue,
      snapshot_date: snapshotDate,
    };

    const { data, error } = await supabaseAdmin
      .from('portfolio_snapshots')
      .upsert(snapshotData, {
        onConflict: 'portfolio_id,snapshot_date',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating portfolio snapshot:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      data, 
      reason: shouldCreateResult.reason 
    };
  } catch (error) {
    console.error('Error in createPortfolioSnapshotConditional:', error);
    return { success: false, error: error.message };
  }
}

