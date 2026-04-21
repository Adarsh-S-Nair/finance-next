import { isLiabilityAccount } from "./accountUtils";

/**
 * Group the flat DB rows returned by /api/plaid/accounts into the
 * institution-grouped shape AccountsProvider (and every consumer of
 * `useAccounts()`) expects. Kept as a shared helper so HouseholdDataProvider
 * can reuse the exact same shape for household-scoped data.
 */
export function transformAccountsData(dbAccounts) {
  const institutionsMap = {};

  (dbAccounts || []).forEach((account) => {
    const institutionId = account.institution_id;
    const institutionName = account.institutions?.name || "Unknown Bank";

    if (!institutionsMap[institutionId]) {
      institutionsMap[institutionId] = {
        id: institutionId,
        name: institutionName,
        logo: account.institutions?.logo,
        primaryColor: account.institutions?.primary_color,
        url: account.institutions?.url,
        plaidItemId: account.plaid_item_id,
        accounts: [],
      };
    }

    institutionsMap[institutionId].accounts.push({
      id: account.id,
      name: account.name,
      type: account.subtype || account.type,
      balance: account.balances?.current || 0,
      available: account.balances?.available ?? null,
      limit: account.balances?.limit ?? null,
      isoCurrencyCode: account.balances?.iso_currency_code || null,
      bank: institutionName,
      mask: account.mask,
      institutionId: account.institution_id,
      itemId: account.item_id,
      accountId: account.account_id,
      createdAt: account.created_at,
      userId: account.user_id,
    });
  });

  return Object.values(institutionsMap).sort((a, b) => a.name.localeCompare(b.name));
}

export function computeAccountTotals(allAccounts) {
  const totalAssets = allAccounts
    .filter((account) => account.balance > 0 && !isLiabilityAccount(account))
    .reduce((sum, account) => sum + account.balance, 0);
  const totalLiabilities = allAccounts
    .filter((account) => account.balance < 0 || isLiabilityAccount(account))
    .reduce((sum, account) => sum + Math.abs(account.balance), 0);
  return {
    totalAssets,
    totalLiabilities,
    totalBalance: totalAssets - totalLiabilities,
  };
}
