import { supabaseAdmin } from './supabaseAdmin';

/**
 * Detects recurring transactions for a user and updates the recurring_transactions table.
 * @param {string} userId - The user ID to detect recurring transactions for.
 */
export async function detectRecurringTransactions(userId) {
  if (!userId) return;

  console.log(`🔍 Starting recurring transaction detection for user: ${userId}`);

  // 1. Fetch transactions from the last 12 months
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: transactions, error } = await supabaseAdmin
    .from('transactions')
    .select('id, amount, datetime, merchant_name, description, account_id, category_id, icon_url')
    .eq('pending', false) // Only look at posted transactions
    .gte('datetime', oneYearAgo.toISOString())
    .order('datetime', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch transactions for detection:', error);
    return;
  }

  // Filter transactions that belong to this user (via accounts)
  const { data: userAccounts } = await supabaseAdmin
    .from('accounts')
    .select('id')
    .eq('user_id', userId);

  const userAccountIds = new Set(userAccounts?.map(a => a.id) || []);

  // Fetch IDs of categories to exclude
  const excludedCategories = [
    'Credit Card Payment',
    'Investment and Retirement Funds',
    'Transfer',
    'Account Transfer' // Covering both "Transfer In" and "Transfer Out" if they map to this, or just general safety
  ];

  // We need to find the IDs for these categories. 
  // Since "Account Transfer" might be a group or specific label, let's be broad.
  // The user specifically mentioned "Credit Card Payment" and "Investment and Retirement Funds".
  // And "Account Transfer" (Transfer In/Out).

  const { data: excludedCategoryRows } = await supabaseAdmin
    .from('system_categories')
    .select('id')
    .in('label', excludedCategories);

  const excludedCategoryIds = new Set(excludedCategoryRows?.map(c => c.id) || []);

  const userTransactions = transactions.filter(t => {
    // Must belong to user
    if (!userAccountIds.has(t.account_id)) return false;

    // Must not be in excluded categories
    if (t.category_id && excludedCategoryIds.has(t.category_id)) return false;

    return true;
  });

  if (userTransactions.length === 0) {
    console.log('ℹ️ No transactions found for user (after filtering).');
    return [];
  }

  // 2. Group by Merchant Name or Description
  const groups = {};

  for (const t of userTransactions) {
    // Normalize name: use merchant_name if available, else description
    // Convert to lowercase and remove common noise (e.g., "Payment to", "Bill")
    let key = t.merchant_name || t.description;
    if (!key) continue;

    key = key.trim();

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push({
      ...t,
      dateObj: new Date(t.datetime)
    });
  }

  // 3. Analyze Patterns
  const recurringCandidates = [];

  for (const [name, txs] of Object.entries(groups)) {
    // Need at least 3 transactions to establish a pattern (unless it's yearly, but let's stick to 3 for now)
    if (txs.length < 3) continue;

    // Sort by date ascending
    txs.sort((a, b) => a.dateObj - b.dateObj);

    const intervals = [];
    for (let i = 1; i < txs.length; i++) {
      const diffTime = Math.abs(txs[i].dateObj - txs[i - 1].dateObj);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      intervals.push(diffDays);
    }

    // Calculate average interval and variance
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    let frequency = null;
    let confidence = 0.0;

    // Heuristics
    if (Math.abs(avgInterval - 7) < 2 && stdDev < 2) {
      frequency = 'weekly';
      confidence = 0.9;
    } else if (Math.abs(avgInterval - 14) < 3 && stdDev < 3) {
      frequency = 'bi-weekly';
      confidence = 0.85;
    } else if (Math.abs(avgInterval - 30.5) < 5 && stdDev < 5) {
      frequency = 'monthly';
      confidence = 0.95;
    } else if (Math.abs(avgInterval - 365) < 10) {
      frequency = 'yearly';
      confidence = 0.8;
    }

    if (frequency) {
      // Check amount consistency
      const amounts = txs.map(t => Math.abs(parseFloat(t.amount)));
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const amountVariance = amounts.reduce((a, b) => a + Math.pow(b - avgAmount, 2), 0) / amounts.length;

      // If amount varies wildly, reduce confidence slightly
      if (amountVariance > 100) { // Arbitrary threshold
        confidence -= 0.1;
      }

      // Calculate next date
      const lastTx = txs[txs.length - 1];
      const nextDate = new Date(lastTx.dateObj);

      if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
      if (frequency === 'bi-weekly') nextDate.setDate(nextDate.getDate() + 14);
      if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
      if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

      // Check for missed payments (Activity Check)
      // If we are significantly past the next_date without a new transaction, it's likely inactive.
      const now = new Date();
      const daysPastDue = (now - nextDate) / (1000 * 60 * 60 * 24);

      let allowedMissedCycles = 1; // Default tolerance
      if (frequency === 'weekly') allowedMissedCycles = 2; // Allow 2 missed weeks
      if (frequency === 'bi-weekly') allowedMissedCycles = 1;
      if (frequency === 'monthly') allowedMissedCycles = 1;
      if (frequency === 'yearly') allowedMissedCycles = 0.2; // ~2 months grace for yearly

      let cycleDays = 30;
      if (frequency === 'weekly') cycleDays = 7;
      if (frequency === 'bi-weekly') cycleDays = 14;
      if (frequency === 'yearly') cycleDays = 365;

      // If we missed too many cycles, reduce confidence drastically or discard
      if (daysPastDue > (cycleDays * allowedMissedCycles)) {
        console.log(`⚠️ Discarding ${name} (${frequency}): Missed ${daysPastDue / cycleDays} cycles.`);
        continue;
      }

      recurringCandidates.push({
        user_id: userId,
        merchant_name: name,
        description: lastTx.description, // Use the most recent description
        amount: avgAmount, // Use average amount
        frequency,
        status: 'active',
        last_date: lastTx.dateObj.toISOString().split('T')[0],
        next_date: nextDate.toISOString().split('T')[0],
        confidence: Math.max(0.1, Math.min(1.0, confidence)), // Clamp between 0.1 and 1.0
        icon_url: lastTx.icon_url,
        category_id: lastTx.category_id
      });
    }
  }

  // 4. Upsert into Database
  if (recurringCandidates.length > 0) {
    console.log(`✅ Detected ${recurringCandidates.length} recurring patterns.`);

    // We want to update existing ones if they exist, or insert new ones.
    // We'll match on (user_id, merchant_name, frequency) roughly.
    // Since we don't have a unique constraint on those, we might duplicate if we aren't careful.
    // For now, let's delete existing auto-detected ones for this user and re-insert?
    // No, that would lose user overrides (like if they set status to 'ignored').

    // Better approach: Try to find existing match by merchant_name
    const { data: existing } = await supabaseAdmin
      .from('recurring_transactions')
      .select('id, merchant_name, status')
      .eq('user_id', userId);

    const existingMap = new Map(existing?.map(e => [e.merchant_name, e]) || []);

    const upsertData = recurringCandidates.map(candidate => {
      const match = existingMap.get(candidate.merchant_name);
      if (match) {
        // Update existing
        return {
          ...candidate,
          id: match.id,
          status: match.status // Preserve status (e.g. if user ignored it)
        };
      }
      return candidate;
    });

    const { error: upsertError } = await supabaseAdmin
      .from('recurring_transactions')
      .upsert(upsertData);

    if (upsertError) {
      console.error('❌ Failed to upsert recurring transactions:', upsertError);
    } else {
      console.log('💾 Recurring transactions saved.');
    }
    return upsertData;
  } else {
    console.log('ℹ️ No recurring patterns detected.');
    return [];
  }
}
