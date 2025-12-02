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
    .select('id, amount, date, datetime, merchant_name, description, account_id, category_id, icon_url')
    .eq('pending', false) // Only look at posted transactions
    .gte('date', oneYearAgo.toISOString().split('T')[0]) // Use date column for filtering
    .order('date', { ascending: false });

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

    // Exclude positive amounts (income, refunds)
    if (t.amount > 0) return false;

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
      dateObj: new Date(t.date) // Use the 'date' column which is already timezone adjusted
    });
  }

  // 3. Analyze Patterns
  const recurringCandidates = [];

  for (const [name, txs] of Object.entries(groups)) {
    // Helper to analyze a set of transactions
    const analyzeSet = (transactions, merchantName) => {
      if (transactions.length < 3) return null;

      // Sort by date ascending
      transactions.sort((a, b) => a.dateObj - b.dateObj);

      // Filter out transactions that are too close (noise/double charges)
      const uniqueTransactions = [transactions[0]];
      for (let i = 1; i < transactions.length; i++) {
        const last = uniqueTransactions[uniqueTransactions.length - 1];
        const diffTime = Math.abs(transactions[i].dateObj - last.dateObj);
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (diffDays >= 4) {
          uniqueTransactions.push(transactions[i]);
        }
      }

      if (uniqueTransactions.length < 3) return null;

      const intervals = [];
      for (let i = 1; i < uniqueTransactions.length; i++) {
        const diffTime = Math.abs(uniqueTransactions[i].dateObj - uniqueTransactions[i - 1].dateObj);
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
        const amounts = uniqueTransactions.map(t => Math.abs(parseFloat(t.amount)));
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const amountVariance = amounts.reduce((a, b) => a + Math.pow(b - avgAmount, 2), 0) / amounts.length;

        // If amount varies wildly, reduce confidence slightly
        if (amountVariance > 100) { // Arbitrary threshold
          confidence -= 0.1;
        }

        // Calculate next date
        const lastTx = uniqueTransactions[uniqueTransactions.length - 1];
        const nextDate = new Date(lastTx.dateObj);

        if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        if (frequency === 'bi-weekly') nextDate.setDate(nextDate.getDate() + 14);
        if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

        // Check for missed payments (Activity Check)
        const now = new Date();
        const daysPastDue = (now - nextDate) / (1000 * 60 * 60 * 24);

        let allowedMissedCycles = 1; // Default tolerance
        if (frequency === 'weekly') allowedMissedCycles = 2;
        if (frequency === 'bi-weekly') allowedMissedCycles = 1;
        if (frequency === 'monthly') allowedMissedCycles = 1;
        if (frequency === 'yearly') allowedMissedCycles = 0.2;

        let cycleDays = 30;
        if (frequency === 'weekly') cycleDays = 7;
        if (frequency === 'bi-weekly') cycleDays = 14;
        if (frequency === 'yearly') cycleDays = 365;

        // If we missed too many cycles, reduce confidence drastically or discard
        if (daysPastDue > (cycleDays * allowedMissedCycles)) {
          console.log(`⚠️ Discarding ${merchantName} (${frequency}): Missed ${daysPastDue / cycleDays} cycles.`);
          return null;
        }

        return {
          user_id: userId,
          merchant_name: merchantName,
          description: lastTx.description,
          amount: Math.abs(parseFloat(lastTx.amount)), // Use latest amount, not average
          frequency,
          status: 'active',
          last_date: lastTx.dateObj.toISOString().split('T')[0],
          next_date: nextDate.toISOString().split('T')[0],
          confidence: Math.max(0.1, Math.min(1.0, confidence)),
          icon_url: lastTx.icon_url,
          category_id: lastTx.category_id
        };
      }
      return null;
    };

    // 1. Try analyzing the whole group first
    const mainResult = analyzeSet(txs, name);
    if (mainResult && mainResult.confidence > 0.8) {
      recurringCandidates.push(mainResult);
      // continue; // REMOVED: Don't skip clustering, we might have multiple subscriptions!
    }

    // 2. If no strong pattern, try clustering by Day of Month (for monthly subscriptions)
    // Map day of month (1-31) to transactions
    const dayClusters = {};
    for (const t of txs) {
      const day = t.dateObj.getDate();
      if (!dayClusters[day]) dayClusters[day] = [];
      dayClusters[day].push(t);
    }

    // Merge nearby clusters (e.g. 5th and 6th might be the same bill)
    const mergedClusters = [];
    const processedDays = new Set();

    for (let day = 1; day <= 31; day++) {
      if (processedDays.has(day)) continue;
      if (!dayClusters[day]) continue;

      let cluster = [...dayClusters[day]];
      processedDays.add(day);

      // Check next 2 days for drift
      for (let offset = 1; offset <= 2; offset++) {
        const nextDay = day + offset;
        if (dayClusters[nextDay]) {
          cluster = cluster.concat(dayClusters[nextDay]);
          processedDays.add(nextDay);
        }
      }

      if (cluster.length >= 3) {
        mergedClusters.push(cluster);
      }
    }

    // Analyze each merged cluster
    for (const cluster of mergedClusters) {
      const clusterResult = analyzeSet(cluster, name);
      if (clusterResult) {
        // Check if we already added a very similar one from "mainResult"
        const isDuplicate = recurringCandidates.some(c =>
          c.merchant_name === name &&
          c.frequency === clusterResult.frequency &&
          Math.abs(new Date(c.next_date) - new Date(clusterResult.next_date)) < (1000 * 60 * 60 * 24 * 3) // Within 3 days
        );

        if (!isDuplicate) {
          recurringCandidates.push(clusterResult);
        }
      }
    }
  }

  // 4. Deduplicate candidates by merchant_name + amount/date
  // Allow multiple subscriptions for the same merchant if they are distinct (different amount or date)
  const finalCandidates = [];

  for (const candidate of recurringCandidates) {
    // Check if we already have a "similar" candidate
    // We only merge if BOTH amount and date are similar (meaning it's the same subscription detected twice)
    const similarIndex = finalCandidates.findIndex(c =>
      c.merchant_name === candidate.merchant_name &&
      Math.abs(c.amount - candidate.amount) < 1.0 && // Same amount (approx)
      Math.abs(new Date(c.next_date) - new Date(candidate.next_date)) < (1000 * 60 * 60 * 24 * 3) // Same date (within 3 days)
    );

    if (similarIndex >= 0) {
      // Conflict: keep higher confidence
      if (candidate.confidence > finalCandidates[similarIndex].confidence) {
        finalCandidates[similarIndex] = candidate;
      }
    } else {
      finalCandidates.push(candidate);
    }
  }

  // 5. Upsert into Database
  if (finalCandidates.length > 0) {
    console.log(`✅ Detected ${finalCandidates.length} recurring patterns (from ${recurringCandidates.length} candidates).`);

    // Better approach: Try to find existing match by merchant_name AND amount
    const { data: existing } = await supabaseAdmin
      .from('recurring_transactions')
      .select('id, merchant_name, amount, status')
      .eq('user_id', userId);

    const matchedIds = new Set();

    const upsertData = finalCandidates.map(candidate => {
      // Find best match in existing that hasn't been used yet
      const match = existing?.find(e =>
        !matchedIds.has(e.id) &&
        e.merchant_name === candidate.merchant_name &&
        Math.abs(parseFloat(e.amount) - candidate.amount) < 5.0 // Match if amount is within $5
      );

      if (match) {
        matchedIds.add(match.id);
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
