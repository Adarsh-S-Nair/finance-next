"use client";

import Sidebar from "./Sidebar";
import HouseholdRail from "./HouseholdRail";
import ProfileBar from "./ProfileBar";
import AppTopbar from "./AppTopbar";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileNavBar from "./MobileNavBar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuLogOut } from "react-icons/lu";
import { useAccounts } from "../providers/AccountsProvider";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import ConfirmOverlay from "../ui/ConfirmOverlay";
import PlaidOAuthHandler from "../PlaidOAuthHandler";
import PaymentFailureBanner from "../PaymentFailureBanner";

function SetupShell({ children }: { children: React.ReactNode }) {
  const { logout } = useUser();
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
    <div className="h-screen overflow-hidden bg-zinc-950 text-white relative">
      {/* Top-left logo */}
      <div className="absolute top-6 left-6 sm:left-8 flex items-center gap-3 z-10">
        <Link href="/" className="inline-flex items-center gap-3">
          <span
            aria-hidden
            className="block h-8 w-8 bg-white"
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
          <span className="text-sm font-semibold tracking-[0.18em] text-white">ZERVO</span>
          {process.env.NEXT_PUBLIC_PLAID_ENV === 'mock' && (
            <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10 leading-none">
              TEST
            </span>
          )}
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-300"
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
            {process.env.NEXT_PUBLIC_PLAID_ENV === 'mock' && (
              <span className="text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10 leading-none">
                TEST
              </span>
            )}
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

  // Track navigation direction for page transition
  const PAGE_ORDER = ['/dashboard', '/transactions', '/accounts', '/budgets', '/investments', '/settings'];
  const prevPathRef = useRef(pathname);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const prevIndex = PAGE_ORDER.findIndex(p => prevPathRef.current?.startsWith(p));
    const nextIndex = PAGE_ORDER.findIndex(p => pathname?.startsWith(p));
    if (prevIndex !== -1 && nextIndex !== -1 && prevIndex !== nextIndex) {
      setDirection(nextIndex > prevIndex ? 1 : -1);
    } else {
      setDirection(1); // default: down
    }
    prevPathRef.current = pathname;
  }, [pathname]);

  const isSetupRoute = pathname === "/setup";
  const isFtuxRoute = pathname === "/dashboard" || pathname === "/accounts";
  const shouldUseSetupShell = isSetupRoute;
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
    <div className="min-h-screen bg-[var(--color-content-bg)] relative">
      {/* Ambient blue glow lives on body::before in globals.css — it needs
          to cover the full viewport including portaled modals, which means
          it can't live inside any React-rendered stacking context. */}
      <HouseholdRail />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        showToggle={isTablet}
      />
      <ProfileBar />
      <div className="min-h-screen flex flex-col transition-all duration-300 ease-in-out md:ml-40 xl:ml-80 relative">
        <PaymentFailureBanner />
        <AppTopbar />
        <main className="flex-1 pt-16 pb-24 md:pb-0 bg-[var(--color-content-bg)]">
          <div
            className={
              pathname === "/dashboard"
                ? "mx-auto max-w-[1600px] px-4 md:px-6 lg:px-10"
                : "mx-auto max-w-[1440px] px-4 md:px-6 lg:px-10"
            }
          >
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: direction * 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
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
  );
}
