"use client";

import Sidebar from "./Sidebar";
import AppTopbar from "./AppTopbar";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MobileNavBar from "./MobileNavBar";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuLogOut } from "react-icons/lu";
import { useAccounts } from "../providers/AccountsProvider";
import { useUser } from "../providers/UserProvider";
import { supabase } from "../../lib/supabase/client";
import ConfirmDialog from "../ui/ConfirmDialog";

function FtuxShell({ children }: { children: React.ReactNode }) {
  const { logout } = useUser();
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
            <span className="text-sm font-semibold tracking-[0.18em] text-zinc-900">ZENTARI</span>
          </Link>
        </div>

        <div className="flex-1">{children}</div>

        <div className="pt-6">
          <button
            onClick={() => setShowLogout(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="Log out"
          >
            <LuLogOut className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      <ConfirmDialog
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
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const pathname = usePathname();
  const { accounts, loading, initialized } = useAccounts();

  const isFtuxRoute = pathname === "/dashboard" || pathname === "/accounts";
  const shouldUseFtuxShell = isFtuxRoute && initialized && !loading && accounts.length === 0;

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

  if (shouldUseFtuxShell) {
    return <FtuxShell>{children}</FtuxShell>;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        toggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        showToggle={isTablet}
      />
      <div className="min-h-screen flex flex-col transition-all duration-300 ease-in-out md:ml-20 xl:ml-64">
        <AppTopbar />
        <main className="flex-1 pt-16 pb-24 md:pb-0">
          <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">{children}</div>
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
    </div>
  );
}
