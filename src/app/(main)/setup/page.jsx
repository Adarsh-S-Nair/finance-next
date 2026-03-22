"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import AccountSetupFlow from "../../../components/ftux/AccountSetupFlow";

export default function SetupPage() {
  const router = useRouter();
  const { user, profile } = useUser();
  const { accounts, loading: accountsLoading, initialized: accountsInitialized, refreshAccounts } = useAccounts();
  const [completing, setCompleting] = useState(false);

  // Guard: if user already has accounts, send them to dashboard
  useEffect(() => {
    if (accountsInitialized && !accountsLoading && accounts.length > 0) {
      router.replace("/dashboard");
    }
  }, [accountsInitialized, accountsLoading, accounts, router]);

  const handleComplete = async () => {
    setCompleting(true);
    await refreshAccounts();
    router.replace("/dashboard");
  };

  // Don't render the setup flow while redirecting
  if (completing || (accountsInitialized && !accountsLoading && accounts.length > 0)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  const meta = profile || user?.user_metadata || {};
  const firstName =
    meta.first_name ||
    meta.name?.split(" ")[0] ||
    meta.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0];
  const name = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
    : undefined;

  return <AccountSetupFlow userName={name} onComplete={handleComplete} />;
}
