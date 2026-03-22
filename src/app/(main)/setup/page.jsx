"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import AccountSetupFlow from "../../../components/ftux/AccountSetupFlow";

export default function SetupPage() {
  const router = useRouter();
  const { user, profile } = useUser();
  const { accounts, loading: accountsLoading, initialized: accountsInitialized, refreshAccounts } = useAccounts();

  // Guard: if user already has accounts, send them to dashboard
  useEffect(() => {
    if (accountsInitialized && !accountsLoading && accounts.length > 0) {
      router.replace("/dashboard");
    }
  }, [accountsInitialized, accountsLoading, accounts, router]);

  const handleComplete = async () => {
    await refreshAccounts();
    router.replace("/dashboard");
  };

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
