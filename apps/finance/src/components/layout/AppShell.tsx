"use client";

import Sidebar from "./Sidebar";
import AppTopbar from "./AppTopbar";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LuLogOut } from "react-icons/lu";
import { useAccounts } from "../providers/AccountsProvider";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import PlaidOAuthHandler from "../PlaidOAuthHandler";
import PaymentFailureBanner from "../PaymentFailureBanner";
import ImpersonationBanner from "../ImpersonationBanner";
import { BrandMark, ConfirmOverlay } from "@zervo/ui";
import { AgentOverlayProvider } from "../agent/AgentOverlayProvider";
import AgentOverlay from "../agent/AgentOverlay";
import BottomAgentInput from "../agent/BottomAgentInput";

function SetupShell({ children }: { children: React.ReactNode }) {
  const { logout } = useUser();
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // FTUX is always rendered light, regardless of user theme preference. The
  // inner AccountSetupFlow uses CSS variables (--color-fg, --color-muted, ...)
  // which resolve to dark values in light mode — pair that with a dark shell
  // and text vanishes into the background. UserProvider's pathname effect
  // re-applies the stored theme on navigation away.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(Boolean(data?.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-zinc-50 text-zinc-900 relative">
      {/* Top-left logo */}
      <div className="absolute top-6 left-6 sm:left-8 z-10">
        <BrandMark size="md" />
      </div>

      {/* Centered content */}
      <div className="h-full flex items-center justify-center">
        {children}
      </div>

      {/* Bottom-left logout icon — only show when authenticated */}
      {isAuthenticated && (
        <div className="absolute bottom-6 left-6 sm:left-8 z-10">
          <button
            onClick={() => setShowLogout(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-900/5 hover:text-zinc-900"
            aria-label="Log out"
          >
            <LuLogOut className="h-4 w-4" />
          </button>
        </div>
      )}

      <ConfirmOverlay
        isOpen={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={async () => {
          try {
            setIsSigningOut(true);
            logout();
            await supabase.auth.signOut();
            window.location.href = "/";
          } finally {
            setIsSigningOut(false);
            setShowLogout(false);
          }
        }}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        busyLabel="Signing out..."
        cancelLabel="Cancel"
        variant="primary"
        busy={isSigningOut}
      />
      <PlaidOAuthHandler />
    </div>
  );
}

function FtuxShell({ children }: { children: React.ReactNode }) {
  const { logout } = useUser();
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // See SetupShell for the reasoning — FTUX is always light so the inner
  // AccountSetupFlow's CSS-variable text reads correctly against the light bg.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(Boolean(data?.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });
    return () => sub.subscription?.unsubscribe?.();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <BrandMark size="lg" href="/dashboard" />
        </div>

        <div className="flex-1">{children}</div>

        {/* Logout — only show when authenticated */}
        {isAuthenticated && (
          <div className="pt-6">
            <button
              onClick={() => setShowLogout(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Log out"
            >
              <LuLogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        )}
      </div>

      <ConfirmOverlay
        isOpen={showLogout}
        onCancel={() => setShowLogout(false)}
        onConfirm={async () => {
          try {
            setIsSigningOut(true);
            logout();
            await supabase.auth.signOut();
            window.location.href = "/";
          } finally {
            setIsSigningOut(false);
            setShowLogout(false);
          }
        }}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        busyLabel="Signing out..."
        cancelLabel="Cancel"
        variant="primary"
        busy={isSigningOut}
      />
      <PlaidOAuthHandler />
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { accounts, loading, initialized } = useAccounts();

  const isSetupRoute = pathname === "/setup";
  // /setup/syncing is the post-FTUX sync splash — same minimal chrome as
  // /setup (logo + content only, no sidebar/topbar). AuthGuard still
  // applies because the user must be signed in to have connected an
  // account, but we don't want the full app shell pulling focus.
  const isSyncingRoute = pathname === "/setup/syncing";
  const isFtuxRoute = pathname === "/dashboard" || pathname === "/accounts";
  const shouldUseSetupShell = isSetupRoute || isSyncingRoute;
  const shouldUseFtuxShell =
    !isSetupRoute && (isFtuxRoute && initialized && !loading && accounts.length === 0);

  if (shouldUseSetupShell) {
    return <SetupShell>{children}</SetupShell>;
  }

  if (shouldUseFtuxShell) {
    return <FtuxShell>{children}</FtuxShell>;
  }

  return (
    <AgentOverlayProvider>
    <div className="min-h-screen bg-[var(--color-content-bg)] relative">
      {/* Impersonation banner is fixed full-width across the top — it
          sets --impersonation-banner-h on documentElement so the sidebar
          + topbar shift down to clear it. */}
      <ImpersonationBanner />
      <Sidebar />
      {/* Sidebar floats at left:12 with w:14 (56px); content starts past
          its right edge plus a 12px breathing gap (12 + 56 + 12 = 80px).
          The sidebar and main content share the same bg so there's no
          card seam — the active-item indicator on each nav row carries
          the visual weight instead. */}
      <div className="min-h-screen flex flex-col md:pl-20 relative pt-[var(--impersonation-banner-h,0px)]">
        <PaymentFailureBanner />
        <main className="flex-1 flex flex-col">
          <div className="flex-1 flex flex-col">
            <AppTopbar />
            <div className="mx-auto w-full max-w-[1600px] px-4 md:px-6 lg:px-10 pb-28 md:pb-32">
              {children}
            </div>
          </div>
        </main>
      </div>

      <PlaidOAuthHandler />
      <BottomAgentInput />
      <AgentOverlay />
    </div>
    </AgentOverlayProvider>
  );
}
