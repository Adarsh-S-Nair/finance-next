"use client";

import Sidebar from "./Sidebar";
import ProfileBar from "./ProfileBar";
import AppTopbar from "./AppTopbar";
import {
  HouseholdRailPanel,
  HouseholdRailProvider,
} from "../households/HouseholdRailExpander";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileNavBar from "./MobileNavBar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuLogOut } from "react-icons/lu";
import { useAccounts } from "../providers/AccountsProvider";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import PlaidOAuthHandler from "../PlaidOAuthHandler";
import PaymentFailureBanner from "../PaymentFailureBanner";
import { ConfirmOverlay } from "@zervo/ui";

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
      <div className="absolute top-6 left-6 sm:left-8 flex items-center gap-3 z-10">
        <Link href="/" className="inline-flex items-center gap-3">
          <span
            aria-hidden
            className="block h-8 w-8 bg-zinc-900"
            style={{
              WebkitMaskImage: "url(/logo.svg)",
              maskImage: "url(/logo.svg)",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
            }}
          />
          <span className="text-sm font-semibold tracking-[0.18em] text-zinc-900">ZERVO</span>
        </Link>
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
          <Link href="/dashboard" className="inline-flex items-center gap-3">
            <span
              aria-hidden
              className="block h-10 w-10 bg-zinc-900"
              style={{
                WebkitMaskImage: "url(/logo.svg)",
                maskImage: "url(/logo.svg)",
                WebkitMaskSize: "contain",
                maskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
              }}
            />
            <span className="text-sm font-semibold tracking-[0.18em] text-zinc-900">ZERVO</span>
          </Link>
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const pathname = usePathname();
  const { accounts, loading, initialized } = useAccounts();

  // Previously this tracked nav direction and slid pages in from the
  // top/bottom. The slide stacked on top of per-card skeleton flashes
  // and made every navigation feel laggy. With react-query caching
  // the page content now paints instantly on remount, so a single
  // quick opacity fade is enough — no direction-aware slide needed.

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

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1280) {
        setIsSidebarCollapsed(false);
        setIsTablet(false);
      } else if (window.innerWidth >= 768) {
        setIsTablet(true);
        setIsSidebarCollapsed(true);
      } else {
        setIsTablet(false);
      }
    };

    handleResize();
    if (window.innerWidth >= 768 && window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (shouldUseSetupShell) {
    return <SetupShell>{children}</SetupShell>;
  }

  if (shouldUseFtuxShell) {
    return <FtuxShell>{children}</FtuxShell>;
  }

  return (
    <HouseholdRailProvider>
    <HouseholdRailPanel />
    <div className="min-h-screen bg-[var(--color-content-bg)] relative">
      {/* Ambient blue glow lives on body::before in globals.css — it needs
          to cover the full viewport including portaled modals, which means
          it can't live inside any React-rendered stacking context. */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        showToggle={isTablet}
      />
      <ProfileBar />
      <div className="min-h-screen flex flex-col transition-all duration-300 ease-in-out md:ml-20 xl:ml-60 relative">
        <PaymentFailureBanner />
        <AppTopbar />
        <main className="flex-1 pt-16 pb-24 md:pb-0 bg-[var(--color-content-bg)]">
          <div
            style={{
              transform: "translateY(var(--rail-offset, 0px))",
              transition: "transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)",
              willChange: "transform",
            }}
            className={
              pathname === "/dashboard"
                ? "mx-auto max-w-[1600px] px-4 md:px-6 lg:px-10"
                : "mx-auto max-w-[1440px] px-4 md:px-6 lg:px-10"
            }
          >
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {isTablet && !isSidebarCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsSidebarCollapsed(true)}
          />
        )}
      </AnimatePresence>

      <MobileNavBar />
      <PlaidOAuthHandler />
    </div>
    </HouseholdRailProvider>
  );
}
