"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "../../../components/providers/UserProvider";
import { useAccounts } from "../../../components/providers/AccountsProvider";
import AccountSetupFlow from "../../../components/ftux/AccountSetupFlow";
import { capitalizeFirstOnly } from "../../../lib/utils/formatName";

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading: userLoading } = useUser();
  const { accounts, loading: accountsLoading, initialized: accountsInitialized, refreshAccounts } = useAccounts();
  const [completing, setCompleting] = useState(false);
  const [initialStep, setInitialStep] = useState(null); // null = still resolving
  const flowActiveRef = useRef(false);

  // Derive the unauthenticated state from UserProvider to avoid deadlocking
  // Supabase's internal auth lock via a direct getUser() call.
  useEffect(() => {
    if (userLoading) return; // Wait until UserProvider has resolved
    if (!user) {
      // Not logged in → start at step 0 (create account)
      setInitialStep(0);
    }
    // If authenticated, the next useEffect will handle it
  }, [user, userLoading]);

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

    if (stepFromUrl !== null && stepFromUrl >= 2 && stepFromUrl <= 5) {
      setInitialStep(stepFromUrl);
      return;
    }

    // Resume from saved onboarding_step in profile, or start at step 2 (welcome)
    // New FTUX order: 0=name (pre-auth), 1=email+pw (creates account), 2=welcome, 3=connecting, 4=connected
    // Authenticated users have already completed steps 0+1, so default to step 2 (welcome)
    const savedStep = profile?.onboarding_step;
    if (savedStep && savedStep >= 2 && savedStep <= 5) {
      setInitialStep(savedStep);
    } else {
      setInitialStep(2); // Default to welcome step for authenticated users
    }
  }, [user, accountsInitialized, accountsLoading, accounts, profile, initialStep, router, searchParams]);

  const handleComplete = async () => {
    flowActiveRef.current = false;
    setCompleting(true);
    // Mark onboarding as complete. This is best-effort — if the write
    // fails we still navigate to the dashboard (the user has already
    // connected accounts at this point), but we log so we can diagnose
    // cases where users get bounced back to /setup on next load.
    try {
      const { upsertUserProfile } = await import("../../../lib/user/profile");
      const { error } = await upsertUserProfile({ onboarding_step: null });
      if (error) {
        console.warn("[setup] failed to clear onboarding_step", error);
      }
    } catch (err) {
      console.warn("[setup] onboarding finalize threw", err);
    }
    await refreshAccounts();
    router.replace("/dashboard");
  };

  if (completing || initialStep === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
        </div>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
