/**
 * Gap Filler for Recurring Transaction Detection
 * 
 * Detects recurring patterns that Plaid's API might miss, particularly:
 * - Mortgage/rent payments
 * - Utility bills
 * - Large ACH transfers
 * 
 * This supplements Plaid's recurring API, not replaces it.
 */

import { supabaseAdmin } from './supabaseAdmin';

// Categories that often get missed by Plaid's recurring detection
const TARGET_CATEGORIES = [
  'LOAN_PAYMENTS',
  'RENT_AND_UTILITIES',
  'HOME_IMPROVEMENT',
  'TRANSFER_OUT',
  'GOVERNMENT_AND_NON_PROFIT'
];

// Minimum amount to consider for detection (filters out small transactions)
const MIN_AMOUNT = 100;

// Number of occurrences required to be considered recurring
const MIN_OCCURRENCES = 3;

// Day variance for monthly detection (payment can be off by this many days)
const DAY_VARIANCE = 5;

// Amount variance percentage (10% = amounts can differ by up to 10%)
const AMOUNT_VARIANCE = 0.15;

/**
 * Detect recurring patterns in transactions that Plaid might have missed
 */
export async function detectMissedRecurring(userId, plaidItemId, existingStreamMerchants) {
  console.log('🔍 Running gap filler detection for missed recurring patterns...');

  // Fetch transactions for this plaid item from the last 12 months
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: transactions, error } = await supabaseAdmin
    .from('transactions')
    .select(`
      id,
      plaid_transaction_id,
      merchant_name,
      description,
      amount,
      datetime,
      personal_finance_category,
      account_id,
      accounts!inner(plaid_item_id)
    `)
    .eq('accounts.plaid_item_id', plaidItemId)
    .lt('amount', -MIN_AMOUNT) // Outflows are negative
    .gte('datetime', twelveMonthsAgo.toISOString())
    .order('datetime', { ascending: false });

  if (error) {
    console.error('Error fetching transactions for gap detection:', error);
    return [];
  }

  if (!transactions || transactions.length === 0) {
    console.log('No transactions found for gap detection');
    return [];
  }

  console.log(`📊 Analyzing ${transactions.length} transactions for missed patterns...`);

  // Group transactions by merchant
  const merchantGroups = groupByMerchant(transactions);

  // Detect recurring patterns
  const detectedPatterns = [];

  for (const [merchantKey, txns] of Object.entries(merchantGroups)) {
    const merchantName = txns[0].merchant_name || txns[0].description?.substring(0, 50);

    // Skip if already detected by Plaid (check by merchant name)
    const normalizedMerchant = merchantName?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const alreadyDetected = existingStreamMerchants.some(existing => {
      const normalizedExisting = existing?.toLowerCase().replace(/[^a-z0-9]/g, '');
      return normalizedExisting && normalizedMerchant &&
        (normalizedExisting.includes(normalizedMerchant) ||
          normalizedMerchant.includes(normalizedExisting));
    });

    if (alreadyDetected) {
      continue;
    }

    // Check if this is a target category we care about
    const category = txns[0].personal_finance_category?.primary;
    const isTargetCategory = !category || TARGET_CATEGORIES.includes(category);

    if (!isTargetCategory) {
      continue;
    }

    // Detect monthly pattern
    const pattern = detectMonthlyPattern(txns);

    if (pattern && pattern.occurrences >= MIN_OCCURRENCES) {
      detectedPatterns.push({
        merchantName,
        pattern,
        transactions: txns,
        category
      });
    }
  }

  console.log(`✅ Found ${detectedPatterns.length} missed recurring patterns`);

  // Convert patterns to recurring_streams format
  return detectedPatterns.map(p => convertToStreamRecord(p, userId, plaidItemId));
}

/**
 * Group transactions by normalized merchant name
 */
function groupByMerchant(transactions) {
  const groups = {};

  for (const txn of transactions) {
    // Use merchant_name if available, otherwise use first part of description
    const key = (txn.merchant_name || txn.description?.substring(0, 30) || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(txn);
  }

  return groups;
}

/**
 * Detect if transactions follow a monthly pattern
 */
function detectMonthlyPattern(transactions) {
  if (transactions.length < MIN_OCCURRENCES) {
    return null;
  }

  // Sort by date descending
  const sorted = [...transactions].sort((a, b) =>
    new Date(b.datetime) - new Date(a.datetime)
  );

  // Check for monthly intervals
  let monthlyCount = 0;
  const amounts = [];
  const dates = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = new Date(sorted[i].datetime);
    const next = new Date(sorted[i + 1].datetime);

    const daysDiff = Math.round((current - next) / (1000 * 60 * 60 * 24));

    // Monthly = 25-35 days apart
    if (daysDiff >= 25 && daysDiff <= 35) {
      monthlyCount++;
    }

    amounts.push(Math.abs(parseFloat(sorted[i].amount)));
    dates.push(sorted[i].datetime);
  }
  amounts.push(Math.abs(parseFloat(sorted[sorted.length - 1].amount)));
  dates.push(sorted[sorted.length - 1].datetime);

  // Need at least MIN_OCCURRENCES-1 monthly intervals
  if (monthlyCount < MIN_OCCURRENCES - 1) {
    return null;
  }

  // Check amount consistency
  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const maxVariance = avgAmount * AMOUNT_VARIANCE;
  const isConsistent = amounts.every(amt => Math.abs(amt - avgAmount) <= maxVariance);

  if (!isConsistent) {
    return null;
  }

  // Calculate predicted next date
  const lastDate = new Date(sorted[0].datetime);
  const predictedNext = new Date(lastDate);
  predictedNext.setMonth(predictedNext.getMonth() + 1);

  return {
    frequency: 'MONTHLY',
    occurrences: monthlyCount + 1,
    averageAmount: avgAmount,
    lastAmount: amounts[0],
    lastDate: sorted[0].datetime,
    predictedNextDate: predictedNext.toISOString().split('T')[0],
    // Store plaid_transaction_id if available, otherwise fallback to id (but this might break API lookup)
    transactionIds: sorted.map(t => t.plaid_transaction_id || t.id)
  };
}

/**
 * Convert detected pattern to recurring_streams record format
 */
function convertToStreamRecord(detected, userId, plaidItemId) {
  const { merchantName, pattern, transactions, category } = detected;

  // Generate a unique stream_id for custom-detected streams
  const streamId = `custom_${plaidItemId}_${merchantName?.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30)}`;

  // Get account_id from the first transaction
  const accountId = transactions[0]?.account_id || 'unknown';

  // Get first and last dates
  const sortedTxns = [...transactions].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const firstDate = sortedTxns[0]?.datetime?.split('T')[0] || pattern.lastDate;
  const lastDate = pattern.lastDate?.split('T')[0] || pattern.lastDate;

  return {
    user_id: userId,
    plaid_item_id: plaidItemId,
    account_id: accountId,
    stream_id: streamId,
    stream_type: 'outflow',
    status: pattern.occurrences >= 6 ? 'MATURE' : 'EARLY_DETECTION',
    description: merchantName,
    merchant_name: merchantName,
    frequency: pattern.frequency,
    first_date: firstDate,
    last_date: lastDate,
    predicted_next_date: pattern.predictedNextDate,
    average_amount: pattern.averageAmount,
    last_amount: pattern.lastAmount,
    is_active: true,
    category_primary: category || 'LOAN_PAYMENTS',
    category_detailed: null,
    transaction_ids: pattern.transactionIds,
    is_custom_detected: true // Flag to indicate this was detected by our system, not Plaid
  };
}
