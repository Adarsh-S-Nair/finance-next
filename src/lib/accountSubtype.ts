/**
 * Format a Plaid account subtype (or type fallback) into a clean display
 * label. Plaid returns subtypes like "checking", "credit card", "401k" —
 * we want "Checking", "Credit Card", "401(k)".
 */
const LABELS: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  "money market": "Money Market",
  cd: "CD",
  "credit card": "Credit Card",
  "401k": "401(k)",
  "401a": "401(a)",
  "403b": "403(b)",
  "457b": "457(b)",
  ira: "IRA",
  "roth ira": "Roth IRA",
  roth: "Roth IRA",
  "roth 401k": "Roth 401(k)",
  sep: "SEP IRA",
  simple: "SIMPLE IRA",
  brokerage: "Brokerage",
  "mutual fund": "Mutual Fund",
  hsa: "HSA",
  "529": "529 Plan",
  mortgage: "Mortgage",
  loan: "Loan",
  student: "Student Loan",
  auto: "Auto Loan",
  "home equity": "Home Equity",
  "line of credit": "Line of Credit",
  depository: "Deposit",
  credit: "Credit",
  investment: "Investment",
};

export function formatAccountSubtype(subtype: string | null | undefined): string {
  if (!subtype) return "";
  const key = subtype.toLowerCase().trim();
  if (LABELS[key]) return LABELS[key];
  return key
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
