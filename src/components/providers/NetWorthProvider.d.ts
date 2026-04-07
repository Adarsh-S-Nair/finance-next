export interface NetWorthDataPoint {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  [key: string]: unknown;
}

export interface NetWorthContextValue {
  netWorthHistory: NetWorthDataPoint[];
  currentNetWorth: { netWorth: number; assets: number; liabilities: number } | null;
  loading: boolean;
  error: string | null;
  refreshNetWorthData: (forceRefresh?: boolean) => Promise<void>;
}

export function NetWorthProvider(props: { children: React.ReactNode }): React.JSX.Element;
export function useNetWorth(): NetWorthContextValue;
