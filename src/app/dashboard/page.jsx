"use client";

import { useEffect } from "react";
import { useUser } from "../../components/UserProvider";
import PageContainer from "../../components/PageContainer";
import AccountsCard from "../../components/dashboard/AccountsCard.jsx";
import SpendingVsEarningCard from "../../components/dashboard/SpendingVsEarningCard.jsx";
import SpendingOverviewCard from "../../components/dashboard/SpendingOverviewCard.jsx";
import RecentTransactionsCard from "../../components/dashboard/RecentTransactionsCard.jsx";

export default function DashboardPage() {
  const { user } = useUser();

  // Call the spending-earning API when dashboard loads
  useEffect(() => {
    const fetchSpendingEarning = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch(`/api/transactions/spending-earning?userId=${user.id}`);
        if (response.ok) {
          const result = await response.json();
          console.log('📊 Monthly Spending & Earning Array:', result.data);
        }
      } catch (error) {
        console.error('Error fetching spending/earning data:', error);
      }
    };

    fetchSpendingEarning();
  }, [user?.id]);

  return (
    <PageContainer title="Dashboard">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <SpendingOverviewCard />
          <SpendingVsEarningCard />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <RecentTransactionsCard />
          <AccountsCard />
        </div>
      </div>
    </PageContainer>
  );
}


