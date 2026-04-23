import { supabaseAdmin } from './supabase/admin';

/**
 * Detects unmatched transfers for a user within a specific date range.
 * Updates the `is_unmatched_transfer` column in the database.
 */
export async function detectUnmatchedTransfers(
  userId: string,
  startDate: string,
  endDate: string
): Promise<void> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialised; skipping detection');
    return;
  }

  try {
    console.log(
      `🔄 Running unmatched transfer detection for user ${userId} from ${startDate} to ${endDate}`
    );

    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select(
        `
        id,
        date,
        amount,
        description,
        merchant_name,
        system_categories!inner (
          id,
          label,
          category_groups (
            name
          )
        ),
        accounts!inner (
          user_id,
          name
        )
      `
      )
      .eq('accounts.user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .not('system_categories', 'is', null);

    if (error) {
      console.error('Error fetching transactions for detection:', error);
      return;
    }

    if (!transactions || transactions.length === 0) {
      console.log('No potential transfer transactions found in range.');
      return;
    }

    type DetectionRow = {
      id: string;
      date: string | null;
      amount: number;
      system_categories?: {
        label?: string | null;
        category_groups?: { name?: string | null } | null;
      } | null;
    };

    const TRANSFER_GROUPS = ['Transfer In', 'Transfer Out'];
    const TRANSFER_LABELS = ['Credit Card Payment'];
    const isTransfer = (tx: DetectionRow): boolean => {
      const groupName = tx.system_categories?.category_groups?.name;
      const label = tx.system_categories?.label;
      return (
        (!!groupName && TRANSFER_GROUPS.includes(groupName)) ||
        (!!label && TRANSFER_LABELS.includes(label))
      );
    };

    const transferTransactions = (transactions as unknown as DetectionRow[]).filter(
      isTransfer
    );

    console.log(
      `Found ${transferTransactions.length} potential transfers to check (out of ${transactions.length} categorized transactions).`
    );

    const updates: { id: string; is_unmatched_transfer: boolean }[] = [];

    for (const tx of transferTransactions) {
      if (tx.amount === 0 || !tx.date) continue;

      const targetAmount = -tx.amount;
      const txDate = new Date(tx.date);

      const windowStart = new Date(txDate);
      windowStart.setDate(windowStart.getDate() - 3);
      const windowStartStr = windowStart.toISOString().split('T')[0];

      const windowEnd = new Date(txDate);
      windowEnd.setDate(windowEnd.getDate() + 3);
      const windowEndStr = windowEnd.toISOString().split('T')[0];

      const { data: matches, error: matchError } = await supabaseAdmin
        .from('transactions')
        .select('id, accounts!inner()')
        .eq('accounts.user_id', userId)
        .eq('amount', targetAmount)
        .gte('date', windowStartStr)
        .lte('date', windowEndStr)
        .neq('id', tx.id)
        .limit(1);

      if (matchError) {
        console.error(`Error checking match for tx ${tx.id}:`, matchError);
        continue;
      }

      const isUnmatched = !matches || matches.length === 0;

      updates.push({
        id: tx.id,
        is_unmatched_transfer: isUnmatched,
      });
    }

    if (updates.length > 0) {
      console.log(`Updating ${updates.length} transactions with detection results...`);

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
