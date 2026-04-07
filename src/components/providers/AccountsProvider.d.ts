export interface AccountsContextValue {
  accounts: any[];
  allAccounts: any[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  totalBalance: number;
  totalAssets: number;
  totalLiabilities: number;
  refreshAccounts: (forceRefresh?: boolean) => Promise<void>;
  addAccount: (account: any) => void;
  removeAccount: (accountId: string) => void;
  lastFetched: number | null;
}

export function AccountsProvider(props: { children: React.ReactNode }): React.JSX.Element;
export function useAccounts(): AccountsContextValue;
