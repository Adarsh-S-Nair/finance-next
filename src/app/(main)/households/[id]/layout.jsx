"use client";

import { useParams } from "next/navigation";
import HouseholdDataProvider from "../../../../components/providers/HouseholdDataProvider";

export default function HouseholdLayout({ children }) {
  const params = useParams();
  const householdId = typeof params?.id === "string" ? params.id : null;
  if (!householdId) return children;
  return <HouseholdDataProvider householdId={householdId}>{children}</HouseholdDataProvider>;
}
