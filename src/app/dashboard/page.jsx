"use client";

import { useEffect } from "react";
import { useUser } from "../../components/UserProvider";
import PageContainer from "../../components/PageContainer";
import SpendingVsEarningCard from "../../components/dashboard/SpendingVsEarningCard.jsx";
import SpendingOverviewCard from "../../components/dashboard/SpendingOverviewCard.jsx";
import RecentTransactionsCard from "../../components/dashboard/RecentTransactionsCard.jsx";

export default function DashboardPage() {
  const { user } = useUser();

  // Removed duplicate fetch; charts/components will fetch as needed

  return (
    <PageContainer title="Dashboard">
      <div className="space-y-4 md:space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <SpendingVsEarningCard />
          <SpendingOverviewCard />
        </div>
        <RecentTransactionsCard />
      </div>
    </PageContainer>
  );
}


