"use client";

import { useEffect } from "react";
import { useUser } from "../../components/UserProvider";
import PageContainer from "../../components/PageContainer";
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
      <div className="space-y-4 md:space-y-6">
        {/* First Row: Spending vs Earning and Spending Overview */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 items-stretch">
          <div className="w-full lg:w-2/3 flex">
            <SpendingVsEarningCard />
          </div>
          <div className="w-full lg:w-1/3 flex">
            <SpendingOverviewCard />
          </div>
        </div>
        
        {/* Second Row: Recent Transactions (2/3 width, positioned to the right) */}
        {/* <div className="flex justify-end">
          <div className="w-2/3">
            <RecentTransactionsCard />
          </div>
        </div> */}
      </div>
    </PageContainer>
  );
}


