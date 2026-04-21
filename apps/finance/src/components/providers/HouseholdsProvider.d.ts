export type HouseholdRole = "owner" | "member";

export type HouseholdSummary = {
  id: string;
  name: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  role: HouseholdRole;
  member_count: number;
};

export type HouseholdsContextValue = {
  households: HouseholdSummary[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useHouseholds(): HouseholdsContextValue;
export default function HouseholdsProvider(props: { children: React.ReactNode }): React.JSX.Element;
