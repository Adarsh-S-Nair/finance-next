"use client";

import { useEffect } from "react";
import { useUser } from "../../components/UserProvider";
import PageContainer from "../../components/PageContainer";
import SpendingVsEarningCard from "../../components/dashboard/SpendingVsEarningCard.jsx";
import DashboardNetWorthCard from "../../components/dashboard/DashboardNetWorthCard";
import IncomeCard from "../../components/dashboard/IncomeCard";
import SpendingCard from "../../components/dashboard/SpendingCard";

export default function DashboardPage() {
  const { user } = useUser();

  return (
    <PageContainer title="Dashboard">
      <div className="space-y-6">
        {/* Top Row: Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Main Net Worth Card */}
          <div className="lg:col-span-1 h-full">
            <DashboardNetWorthCard />
          </div>

          {/* Income and Spending Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 h-full">
            <IncomeCard />
            <SpendingCard />
          </div>
        </div>

        {/* Charts */}
        <div className="h-[400px]">
          <SpendingVsEarningCard />
        </div>
      </div>
    </PageContainer>
  );
}
