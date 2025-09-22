import PageContainer from "../../components/PageContainer";
import NetWorthCard from "../../components/dashboard/NetWorthCard";
import AccountsCard from "../../components/dashboard/AccountsCard.jsx";
import SpendingBreakdownCard from "../../components/dashboard/SpendingBreakdownCard.jsx";
import SpendingVsEarningCard from "../../components/dashboard/SpendingVsEarningCard.jsx";

export default function DashboardPage() {
  return (
    <PageContainer title="Dashboard">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <NetWorthCard />
          <AccountsCard />
        </div>
        <div className="flex flex-col lg:flex-row gap-6">
          <SpendingBreakdownCard />
          <SpendingVsEarningCard />
        </div>
      </div>
    </PageContainer>
  );
}


