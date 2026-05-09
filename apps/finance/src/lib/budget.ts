// Whether a budget is considered over.
//
// Sub-dollar overages don't count. A $4,858 budget with $4,858.11 spent is
// "at budget", not over — users pick round numbers, recurring charges land
// at fixed cents, and rendering an 11-cent overage in red looks broken. The
// threshold is "at least $1 over" so a $4,859 spend on a $4,858 budget does
// flag.
export function isBudgetOver(spent: number, budgetAmount: number): boolean {
  const s = Number(spent);
  const b = Number(budgetAmount);
  if (!Number.isFinite(s) || !Number.isFinite(b)) return false;
  return s - b >= 1;
}
