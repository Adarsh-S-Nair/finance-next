import { supabaseAdmin } from './supabaseAdmin';
import { randomUUID } from 'crypto';

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

  // Fetch all system categories for lookup
  const { data: allCategories } = await supabaseAdmin
    .from('system_categories')
    .select('id, label');

  const categoryMap = new Map();
  if (allCategories) {
    for (const cat of allCategories) {
      categoryMap.set(cat.id, cat.label);
    }
  }

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
      // Allow 2 transactions if they are RECENT and IDENTICAL (New Subscription)
      if (transactions.length < 2) return null;

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

      // If we filtered down to < 2, definitely return null
      if (uniqueTransactions.length < 2) return null;

      // STRICT CHECK FOR 2 TRANSACTIONS (New Subscription Detection)
      if (uniqueTransactions.length === 2) {
        const t1 = uniqueTransactions[0];
        const t2 = uniqueTransactions[1];

        const diffTime = Math.abs(t2.dateObj - t1.dateObj);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Must be monthly (28-31 days)
        const isMonthly = diffDays >= 28 && diffDays <= 31;

        // Must be EXACT same amount
        const isSameAmount = Math.abs(parseFloat(t1.amount) - parseFloat(t2.amount)) < 0.01;

        // Must be same day of month (or very close, e.g. 28th and 29th)
        const isSameDay = Math.abs(t1.dateObj.getDate() - t2.dateObj.getDate()) <= 1;

        if (isMonthly && isSameAmount && isSameDay) {
          // It's a match!
          const nextDate = new Date(t2.dateObj);
          nextDate.setMonth(nextDate.getMonth() + 1);

          return {
            user_id: userId,
            merchant_name: merchantName,
            description: t2.description,
            amount: Math.abs(parseFloat(t2.amount)),
            frequency: 'monthly',
            status: 'active',
            last_date: t2.dateObj.toISOString().split('T')[0],
            next_date: nextDate.toISOString().split('T')[0],
            confidence: 0.85, // High confidence because it's exact
            icon_url: t2.icon_url,
            category_id: t2.category_id
          };
        }
        // If not a perfect match, we need 3+ transactions
        return null;
      }

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

      // Check Category
      const lastTx = uniqueTransactions[uniqueTransactions.length - 1];
      const categoryLabel = (categoryMap.get(lastTx.category_id) || '');

      // Precise Utility Detection
      const isUtility = [
        'Gas and Electricity',
        'Water',
        'Internet',
        'Insurance',
        'Home Phone',
        'Mobile Phone',
        'Cable'
      ].includes(categoryLabel);

      // Precise Variable/Habitual Expense Detection
      const isVariableCategory = [
        'Coffee',
        'Gas', // Exact match for gas stations
        'Taxis and Ride Shares',
        'Discount Stores',
        'Food and Drink'
      ].includes(categoryLabel);

      // HARD EXCLUSION: These categories should almost NEVER be subscriptions
      // The user explicitly requested "Fast Food" to be ignored.
      const isExcludedCategory = [
        'Fast Food',
        'Convenience Stores',
        'Restaurants'
      ].includes(categoryLabel);

      if (isExcludedCategory) return null;

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
      } else if (Math.abs(avgInterval - 61) < 10 && stdDev < 10) {
        // Bi-monthly or skipped month
        frequency = 'monthly';
        confidence = 0.85;
      } else if (Math.abs(avgInterval - 91.5) < 10 && stdDev < 10) {
        // Quarterly or skipped months
        frequency = 'monthly';
        confidence = 0.8;
      } else if (Math.abs(avgInterval - 365) < 10) {
        frequency = 'yearly';
        confidence = 0.8;
      } else if (isUtility && avgInterval >= 25 && avgInterval <= 100) {
        // IRREGULAR UTILITY FIX (Pseg/National Grid):
        // Utilities often have weird intervals (28 days, 35 days, 60 days, 80 days)
        // If it's explicitly a utility, we allow a wide range of "monthly-ish" intervals
        // and ignore standard deviation.
        frequency = 'monthly';
        confidence = 0.8;
      }

      if (frequency) {
        // Check amount consistency
        const amounts = uniqueTransactions.map(t => Math.abs(parseFloat(t.amount)));
        const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const amountVariance = amounts.reduce((a, b) => a + Math.pow(b - avgAmount, 2), 0) / amounts.length;

        // FALSE POSITIVE REDUCTION (Coffee/Gas/etc.):
        // If it's a "variable" category AND amount is small (< $50),
        // we require strict checks to distinguish subscriptions from habits.
        if (isVariableCategory && avgAmount < 50) {
          // 1. Amount Consistency: Must be EXTREMELY consistent (like Spotify)
          // Variance of 1.0 means stdDev of $1.00.
          if (amountVariance > 1.0) {
            return null;
          }

          // 2. Day-of-Month Consistency: Subscriptions hit on the same day (e.g., 15th).
          // Habits (7-Eleven) happen on random days.
          const daysOfMonth = uniqueTransactions.map(t => t.dateObj.getDate());
          const avgDay = daysOfMonth.reduce((a, b) => a + b, 0) / daysOfMonth.length;
          const dayVariance = daysOfMonth.reduce((a, b) => a + Math.pow(b - avgDay, 2), 0) / daysOfMonth.length;
          const dayStdDev = Math.sqrt(dayVariance);

          // Allow small drift (weekend shifts), but not random days.
          // stdDev < 3 means mostly within +/- 3 days.
          if (dayStdDev > 3) {
            return null;
          }
        }

        // If amount varies wildly, reduce confidence slightly
        // But for utilities, we expect variance, so we don't penalize as much or at all if it's a utility
        if (amountVariance > 2000 && !isUtility) {
          confidence -= 0.1;
        }

        // Calculate next date
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

        // Allow more missed cycles for irregular utilities
        if (isUtility) allowedMissedCycles = 2;

        let cycleDays = 30;
        if (frequency === 'weekly') cycleDays = 7;
        if (frequency === 'bi-weekly') cycleDays = 14;
        if (frequency === 'yearly') cycleDays = 365;

        // If we missed too many cycles, reduce confidence drastically or discard
        if (daysPastDue > (cycleDays * allowedMissedCycles)) {
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
    if (mainResult && mainResult.confidence > 0.7) {
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
      // New candidate: generate ID client-side to avoid null issues in bulk upsert
      return {
        ...candidate,
        id: randomUUID()
      };
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
