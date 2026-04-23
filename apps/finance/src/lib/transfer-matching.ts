/**
 * Shared transfer-matching utilities used by multiple transaction API routes.
 * Identifies pairs of transfer transactions (e.g. credit card payments) so they
 * can be excluded from spending / earning calculations.
 */

export const TRANSFER_GROUPS = ['Transfer In', 'Transfer Out'] as const;
export const TRANSFER_LABELS = ['Credit Card Payment'] as const;

export interface TransferShape {
  id: string;
  amount: number | string;
  date: string | null;
  system_categories?: {
    label?: string | null;
    category_groups?: {
      name?: string | null;
    } | null;
  } | null;
}

const TRANSFER_GROUPS_LOWER: readonly string[] = TRANSFER_GROUPS.map((g) =>
  g.toLowerCase()
);
const TRANSFER_LABELS_READONLY: readonly string[] = TRANSFER_LABELS;

export function isTransfer(tx: TransferShape): boolean {
  const groupName = tx.system_categories?.category_groups?.name?.toLowerCase();
  const label = tx.system_categories?.label;
  return (
    (!!groupName && TRANSFER_GROUPS_LOWER.includes(groupName)) ||
    (!!label && TRANSFER_LABELS_READONLY.includes(label))
  );
}

/**
 * Identifies matched transfer pairs in a sorted (ascending date) transaction list.
 *
 * For each transfer transaction, looks forward up to 3 calendar days for a
 * transaction with the exact opposite amount, and marks both as "matched".
 * Matched transfers should be excluded from cashflow calculations entirely.
 */
export function identifyTransfers(transactions: TransferShape[]): {
  matchedIds: Set<string>;
} {
  const matchedIds = new Set<string>();

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (matchedIds.has(tx.id)) continue;

    if (isTransfer(tx)) {
      if (!tx.date) continue;
      const txDate = new Date(tx.date);
      const targetAmount = -parseFloat(String(tx.amount));

      for (let j = i + 1; j < transactions.length; j++) {
        const candidate = transactions[j];
        if (matchedIds.has(candidate.id)) continue;
        if (!candidate.date) continue;

        const candidateDate = new Date(candidate.date);
        const diffDays =
          (candidateDate.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays > 3) break;

        if (Math.abs(parseFloat(String(candidate.amount)) - targetAmount) < 0.01) {
          matchedIds.add(tx.id);
          matchedIds.add(candidate.id);
          break;
        }
      }
    }
  }

  return { matchedIds };
}
