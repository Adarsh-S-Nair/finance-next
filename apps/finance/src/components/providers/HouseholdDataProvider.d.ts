import { ReactNode } from "react";

export type HouseholdMember = {
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  email: string | null;
};

export type HouseholdMetaValue = {
  household: {
    id: string;
    name: string;
    color: string;
    role: "owner" | "member";
    member_count: number;
  } | null;
  members: HouseholdMember[];
  memberByUserId: Map<string, HouseholdMember>;
  excludedMemberIds: Set<string>;
  toggleMember: (userId: string) => void;
};

export function useHouseholdMeta(): HouseholdMetaValue;
export default function HouseholdDataProvider(props: {
  householdId: string;
  children: ReactNode;
}): React.JSX.Element;
