import { supabaseAdmin } from './supabaseAdmin';

/**
 * Detects unmatched transfers for a user within a specific date range.
 * Updates the `is_unmatched_transfer` column in the database.
 * 
 * @param {string} userId - The user ID
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 */
export async function detectUnmatchedTransfers(userId, startDate, endDate) {
  try {
    console.log(`🔄 Running unmatched transfer detection for user ${userId} from ${startDate} to ${endDate}`);

    // 1. Fetch potential transfer transactions in the range
    // We look for specific categories that imply a transfer
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select(`
        id,
        date,
        amount,
        description,
        merchant_name,
        system_categories!inner (
          label
        ),
        accounts!inner (
          user_id,
          name
        )
      `)
      .eq('accounts.user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .in('system_categories.label', ['Credit Card Payment', 'Transfer', 'Account Transfer']);

    if (error) {
      console.error('Error fetching transactions for detection:', error);
      return;
    }

    if (!transactions || transactions.length === 0) {
      console.log('No potential transfer transactions found in range.');
      return;
    }

    console.log(`Found ${transactions.length} potential transfers to check.`);

    // 2. For each transaction, check for a match
    const updates = [];

    for (const tx of transactions) {
      // Skip zero amount transactions
      if (tx.amount === 0) continue;

      const targetAmount = -tx.amount; // Look for opposite sign
      const txDate = new Date(tx.date);

      // Date window: +/- 3 days
      const windowStart = new Date(txDate);
      windowStart.setDate(windowStart.getDate() - 3);
      const windowStartStr = windowStart.toISOString().split('T')[0];

      const windowEnd = new Date(txDate);
      windowEnd.setDate(windowEnd.getDate() + 3);
      const windowEndStr = windowEnd.toISOString().split('T')[0];

      // Query for a matching transaction
      const { data: matches, error: matchError } = await supabaseAdmin
        .from('transactions')
        .select('id, accounts!inner()')
        .eq('accounts.user_id', userId)
        .eq('amount', targetAmount)
        .gte('date', windowStartStr)
        .lte('date', windowEndStr)
        .neq('id', tx.id) // Don't match self
        .limit(1);

      if (matchError) {
        console.error(`Error checking match for tx ${tx.id}:`, matchError);
        continue;
      }

      const isUnmatched = !matches || matches.length === 0;

      // Only update if the status is different to save DB writes? 
      // Or just update always to be safe. Let's batch update if possible, but for now loop is fine for safety.
      // Actually, we should probably check if the current status is different before pushing to updates.
      // But we didn't select `is_unmatched_transfer` in the first query.

      updates.push({
        id: tx.id,
        is_unmatched_transfer: isUnmatched
      });
    }

    // 3. Perform updates
    // We can do this in parallel or batch
    if (updates.length > 0) {
      console.log(`Updating ${updates.length} transactions with detection results...`);

      // Upsert is not ideal here because we only want to update one column.
      // We have to iterate and update.
      for (const update of updates) {
        await supabaseAdmin
          .from('transactions')
          .update({ is_unmatched_transfer: update.is_unmatched_transfer })
          .eq('id', update.id);
      }

      console.log('✅ Unmatched transfer detection completed.');
    }

  } catch (err) {
    console.error('Unexpected error in detectUnmatchedTransfers:', err);
  }
}
