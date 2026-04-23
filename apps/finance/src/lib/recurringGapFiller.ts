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

import { supabaseAdmin } from './supabase/admin';

const TARGET_CATEGORIES = [
  'LOAN_PAYMENTS',
  'RENT_AND_UTILITIES',
  'HOME_IMPROVEMENT',
  'TRANSFER_OUT',
  'GOVERNMENT_AND_NON_PROFIT',
];

const MIN_AMOUNT = 100;
const MIN_OCCURRENCES = 3;
// const DAY_VARIANCE = 5; // currently unused — left as documentation
const AMOUNT_VARIANCE = 0.15;

interface TransactionRow {
  id: string;
  plaid_transaction_id: string | null;
  merchant_name: string | null;
  description: string | null;
  amount: number;
  datetime: string | null;
  personal_finance_category: { primary?: string | null } | null;
  account_id: string;
}

interface DetectedPattern {
  frequency: 'MONTHLY';
  occurrences: number;
  averageAmount: number;
  lastAmount: number;
  lastDate: string;
  predictedNextDate: string;
  transactionIds: string[];
}

interface DetectedGroup {
  merchantName: string;
  pattern: DetectedPattern;
  transactions: TransactionRow[];
  category: string | null | undefined;
}

/**
 * Detect recurring patterns in transactions that Plaid might have missed
 */
export async function detectMissedRecurring(
  userId: string,
  plaidItemId: string,
  existingStreamMerchants: (string | null)[]
): Promise<Record<string, unknown>[]> {
  console.log('🔍 Running gap filler detection for missed recurring patterns...');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { data: transactions, error } = await supabaseAdmin
    .from('transactions')
    .select(
      `
      id,
      plaid_transaction_id,
      merchant_name,
      description,
      amount,
      datetime,
      personal_finance_category,
      account_id,
      accounts!inner(plaid_item_id)
    `
    )
    .eq('accounts.plaid_item_id', plaidItemId)
    .lt('amount', -MIN_AMOUNT)
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

  const txs = transactions as unknown as TransactionRow[];
  const merchantGroups = groupByMerchant(txs);

  const detectedPatterns: DetectedGroup[] = [];

  for (const [, txns] of Object.entries(merchantGroups)) {
    const merchantName = txns[0].merchant_name || txns[0].description?.substring(0, 50) || '';

    const normalizedMerchant = merchantName?.toLowerCase().replace(/[^a-z0-9]/g, '');
    const alreadyDetected = existingStreamMerchants.some((existing) => {
      const normalizedExisting = existing?.toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        normalizedExisting &&
        normalizedMerchant &&
        (normalizedExisting.includes(normalizedMerchant) ||
          normalizedMerchant.includes(normalizedExisting))
      );
    });

    if (alreadyDetected) continue;

    const category = txns[0].personal_finance_category?.primary;
    const isTargetCategory = !category || TARGET_CATEGORIES.includes(category);

    if (!isTargetCategory) continue;

    const pattern = detectMonthlyPattern(txns);

    if (pattern && pattern.occurrences >= MIN_OCCURRENCES) {
      detectedPatterns.push({
        merchantName,
        pattern,
        transactions: txns,
        category,
      });
    }
  }

  console.log(`✅ Found ${detectedPatterns.length} missed recurring patterns`);

  return detectedPatterns.map((p) => convertToStreamRecord(p, userId, plaidItemId));
}

function groupByMerchant(transactions: TransactionRow[]): Record<string, TransactionRow[]> {
  const groups: Record<string, TransactionRow[]> = {};

  for (const txn of transactions) {
    const key = (txn.merchant_name || txn.description?.substring(0, 30) || 'unknown')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    if (!groups[key]) groups[key] = [];
    groups[key].push(txn);
  }

  return groups;
}

function detectMonthlyPattern(transactions: TransactionRow[]): DetectedPattern | null {
  if (transactions.length < MIN_OCCURRENCES) return null;

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.datetime ?? 0).getTime() - new Date(a.datetime ?? 0).getTime()
  );

  let monthlyCount = 0;
  const amounts: number[] = [];
  const dates: string[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = new Date(sorted[i].datetime ?? 0);
    const next = new Date(sorted[i + 1].datetime ?? 0);

    const daysDiff = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff >= 25 && daysDiff <= 35) {
      monthlyCount++;
    }

    amounts.push(Math.abs(Number(sorted[i].amount)));
    dates.push(sorted[i].datetime ?? '');
  }
  amounts.push(Math.abs(Number(sorted[sorted.length - 1].amount)));
  dates.push(sorted[sorted.length - 1].datetime ?? '');

  if (monthlyCount < MIN_OCCURRENCES - 1) return null;

  const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const maxVariance = avgAmount * AMOUNT_VARIANCE;
  const isConsistent = amounts.every((amt) => Math.abs(amt - avgAmount) <= maxVariance);

  if (!isConsistent) return null;

  const lastDateStr = sorted[0].datetime ?? '';
  const lastDate = new Date(lastDateStr);
  const predictedNext = new Date(lastDate);
  predictedNext.setMonth(predictedNext.getMonth() + 1);

  return {
    frequency: 'MONTHLY',
    occurrences: monthlyCount + 1,
    averageAmount: avgAmount,
    lastAmount: amounts[0],
    lastDate: lastDateStr,
    predictedNextDate: predictedNext.toISOString().split('T')[0],
    transactionIds: sorted.map((t) => t.plaid_transaction_id || t.id),
  };
}

function convertToStreamRecord(
  detected: DetectedGroup,
  userId: string,
  plaidItemId: string
): Record<string, unknown> {
  const { merchantName, pattern, transactions, category } = detected;

  const streamId = `custom_${plaidItemId}_${merchantName?.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30)}`;

  const accountId = transactions[0]?.account_id || 'unknown';

  const sortedTxns = [...transactions].sort(
    (a, b) => new Date(a.datetime ?? 0).getTime() - new Date(b.datetime ?? 0).getTime()
  );
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
    is_custom_detected: true,
  };
}
