const LIABILITY_TYPES = [
  'credit card',
  'credit',
  'loan',
  'mortgage',
  'line of credit',
  'overdraft',
  'other',
];

/**
 * Determine if an account is a liability (credit card, loan, mortgage, etc.)
 * Checks both subtype and type fields for maximum coverage.
 */
export function isLiabilityAccount(account) {
  const accountType = (account.subtype || account.type || '').toLowerCase();
  return LIABILITY_TYPES.some(type => accountType.includes(type));
}
