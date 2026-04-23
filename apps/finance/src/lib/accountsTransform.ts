import { isLiabilityAccount } from './accountUtils';

interface DbAccountBalances {
  current?: number | null;
  available?: number | null;
  limit?: number | null;
  iso_currency_code?: string | null;
}

interface DbInstitution {
  name?: string | null;
  logo?: string | null;
  primary_color?: string | null;
  url?: string | null;
}

export interface DbAccountRow {
  id: string;
  name: string;
  type?: string | null;
  subtype?: string | null;
  mask?: string | null;
  institution_id?: string | null;
  item_id?: string | null;
  account_id?: string | null;
  plaid_item_id?: string | null;
  created_at?: string | null;
  user_id?: string | null;
  balances?: DbAccountBalances | null;
  institutions?: DbInstitution | null;
}

export interface UiAccount {
  id: string;
  name: string;
  type: string | null;
  balance: number;
  available: number | null;
  limit: number | null;
  isoCurrencyCode: string | null;
  bank: string;
  mask: string | null;
  institutionId: string | null;
  itemId: string | null;
  accountId: string | null;
  createdAt: string | null;
  userId: string | null;
}

export interface UiInstitutionGroup {
  id: string | null;
  name: string;
  logo?: string | null;
  primaryColor?: string | null;
  url?: string | null;
  plaidItemId?: string | null;
  accounts: UiAccount[];
}

/**
 * Group the flat DB rows returned by /api/plaid/accounts into the
 * institution-grouped shape AccountsProvider (and every consumer of
 * `useAccounts()`) expects. Kept as a shared helper so HouseholdDataProvider
 * can reuse the exact same shape for household-scoped data.
 */
export function transformAccountsData(
  dbAccounts: DbAccountRow[] | null | undefined
): UiInstitutionGroup[] {
  const institutionsMap: Record<string, UiInstitutionGroup> = {};

  (dbAccounts || []).forEach((account) => {
    const institutionId = account.institution_id ?? '';
    const institutionName = account.institutions?.name || 'Unknown Bank';

    if (!institutionsMap[institutionId]) {
      institutionsMap[institutionId] = {
        id: account.institution_id ?? null,
        name: institutionName,
        logo: account.institutions?.logo,
        primaryColor: account.institutions?.primary_color,
        url: account.institutions?.url,
        plaidItemId: account.plaid_item_id ?? undefined,
        accounts: [],
      };
    }

    institutionsMap[institutionId].accounts.push({
      id: account.id,
      name: account.name,
      type: account.subtype || account.type || null,
      balance: account.balances?.current ?? 0,
      available: account.balances?.available ?? null,
      limit: account.balances?.limit ?? null,
      isoCurrencyCode: account.balances?.iso_currency_code ?? null,
      bank: institutionName,
      mask: account.mask ?? null,
      institutionId: account.institution_id ?? null,
      itemId: account.item_id ?? null,
      accountId: account.account_id ?? null,
      createdAt: account.created_at ?? null,
      userId: account.user_id ?? null,
    });
  });

  return Object.values(institutionsMap).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

interface AccountTotals {
  totalAssets: number;
  totalLiabilities: number;
  totalBalance: number;
}

export function computeAccountTotals(
  allAccounts: UiAccount[]
): AccountTotals {
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
