/**
 * Shared transfer-matching utilities used by multiple transaction API routes.
 * Identifies pairs of transfer transactions (e.g. credit card payments) so they
 * can be excluded from spending / earning calculations.
 */

export const TRANSFER_GROUPS = ['Transfer In', 'Transfer Out'];
export const TRANSFER_LABELS = ['Credit Card Payment'];

/**
 * Returns true if the given transaction belongs to a transfer category.
 * Requires `system_categories.category_groups.name` and `system_categories.label`
 * to be present on the transaction object.
 */
export function isTransfer(tx) {
  const groupName = tx.system_categories?.category_groups?.name;
  const label = tx.system_categories?.label;
  return (
    (groupName && TRANSFER_GROUPS.includes(groupName)) ||
    (label && TRANSFER_LABELS.includes(label))
  );
}

/**
 * Identifies matched transfer pairs in a sorted (ascending date) transaction list.
 *
 * For each transfer transaction, looks forward up to 3 calendar days for a
 * transaction with the exact opposite amount, and marks both as "matched".
 * Matched transfers should be excluded from cashflow calculations entirely.
 *
 * @param {Array} transactions - Array of transaction objects sorted by date ascending.
 *   Each transaction must have: id, amount, date, system_categories (with category_groups)
 * @returns {{ matchedIds: Set<string> }} - Set of transaction IDs that form matched pairs.
 */
export function identifyTransfers(transactions) {
  const matchedIds = new Set();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (matchedIds.has(tx.id)) continue;

    if (isTransfer(tx)) {
      const txDate = new Date(tx.date);
      const targetAmount = -parseFloat(tx.amount);

      for (let j = i + 1; j < transactions.length; j++) {
        const candidate = transactions[j];
        if (matchedIds.has(candidate.id)) continue;

        const candidateDate = new Date(candidate.date);
        const diffDays = (candidateDate - txDate) / (1000 * 60 * 60 * 24);

        if (diffDays > 3) break; // Array is sorted by date; no point scanning further

        if (Math.abs(parseFloat(candidate.amount) - targetAmount) < 0.01) {
          matchedIds.add(tx.id);
          matchedIds.add(candidate.id);
          break;
        }
      }
    }
  }

  return { matchedIds };
}
