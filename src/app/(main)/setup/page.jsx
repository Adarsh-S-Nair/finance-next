"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import AccountSetupFlow from "../../../components/ftux/AccountSetupFlow";
import { capitalizeFirstOnly } from "../../../lib/utils/formatName";
import { supabase } from "../../../lib/supabase/client";

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile } = useUser();
  const { accounts, loading: accountsLoading, initialized: accountsInitialized, refreshAccounts } = useAccounts();
  const [completing, setCompleting] = useState(false);
  const [initialStep, setInitialStep] = useState(null); // null = still resolving
  const flowActiveRef = useRef(false);

  // Determine starting step for unauthenticated users
  useEffect(() => {
    async function resolveForUnauthenticated() {
      const { data } = await supabase.auth.getUser();
      const currentUser = data?.user;

      if (!currentUser) {
        // Not logged in → start at step 0 (create account)
        setInitialStep(0);
      }
      // If authenticated, the next useEffect will handle it
    }

    resolveForUnauthenticated();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once accounts are initialized and user is known, determine proper step
  useEffect(() => {
    if (!user) return; // Not authenticated yet — step 0 is set above
    if (initialStep !== null) return; // Already resolved

    if (!accountsInitialized || accountsLoading) return;

    if (accounts.length > 0 && !flowActiveRef.current) {
      // User has accounts — onboarding complete, redirect to dashboard
      router.replace("/dashboard");
      return;
    }

    // Check for step in URL query param (e.g. from login redirect)
    const stepParam = searchParams.get("step");
    const stepFromUrl = stepParam ? parseInt(stepParam, 10) : null;

    if (stepFromUrl !== null && stepFromUrl >= 1 && stepFromUrl <= 4) {
      setInitialStep(stepFromUrl);
      return;
    }

    // Resume from saved onboarding_step in profile, or start at step 1 (name)
    const savedStep = profile?.onboarding_step;
    if (savedStep && savedStep >= 1 && savedStep <= 4) {
      setInitialStep(savedStep);
    } else {
      setInitialStep(1); // Default to name step for authenticated users
    }
  }, [user, accountsInitialized, accountsLoading, accounts, profile, initialStep, router, searchParams]);

  const handleComplete = async () => {
    flowActiveRef.current = false;
    setCompleting(true);
    // Mark onboarding as complete
    try {
      const { upsertUserProfile } = await import("../../../lib/user/profile");
      await upsertUserProfile({ onboarding_step: null });
    } catch {}
    await refreshAccounts();
    router.replace("/dashboard");
  };

  if (completing || initialStep === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  // Resolve display name for authenticated users resuming from step 1+
  const profileMeta = profile || {};
  const userMeta = user?.user_metadata || {};
  const firstName =
    profileMeta.first_name ||
    userMeta.first_name ||
    userMeta.name?.split(" ")[0] ||
    userMeta.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0];
  const name = firstName ? capitalizeFirstOnly(firstName) : undefined;

  return (
    <AccountSetupFlow
      initialStep={initialStep}
      userName={initialStep >= 2 ? name : undefined}
      onComplete={handleComplete}
      onFlowStart={() => { flowActiveRef.current = true; }}
    />
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
