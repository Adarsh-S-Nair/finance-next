"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { LuMenu } from "react-icons/lu";
import DebugMemoryStats from "./DebugMemoryStats";
import { motion } from "framer-motion";
import ConfirmDialog from "./ui/ConfirmDialog";
import { useUser } from "./UserProvider";
import { useRouter } from "next/navigation";

export default function AppTopbar({ isSidebarCollapsed }: { isSidebarCollapsed?: boolean }) {
  const [profileUrl, setProfileUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [showLogout, setShowLogout] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { logout } = useUser();
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) return;

      // Original profile logic
      const first = (user.user_metadata?.first_name as string | undefined) || "";
      const last = (user.user_metadata?.last_name as string | undefined) || "";
      const composite = `${first} ${last}`.trim();
      const altName = (user.user_metadata?.name as string | undefined) || (user.user_metadata?.full_name as string | undefined) || composite || "User";
      setDisplayName(altName);
      setProfileUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(altName)}&background=random&bold=true`);
    };
    void load();
  }, []);

  return (
    <header id="app-topbar" className="fixed top-0 right-0 z-40 min-h-16 bg-[var(--color-bg)]/90 backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--color-bg),transparent_6%)] border-transparent flex flex-col transition-all duration-300 ease-in-out left-0 md:left-20 xl:left-64">
      <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8 h-16 w-full flex items-center gap-3 shrink-0 relative">

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 lg:static lg:translate-x-0 lg:translate-y-0 lg:flex-1 flex items-center gap-3 md:hidden">
          <motion.div
            className="h-8 w-8 bg-[var(--color-fg)]"
            style={{
              maskImage: 'url(/logo.svg)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: 'url(/logo.svg)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center'
            }}
            whileHover={{ scale: 1.05, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          />
          <h1 className="text-sm font-bold tracking-[0.2em] text-[var(--color-fg)] uppercase hidden sm:block" style={{ fontFamily: 'var(--font-poppins)' }}>
            ZENTARI
          </h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {process.env.NEXT_PUBLIC_DEBUG_MEMORY === '1' && <DebugMemoryStats />}
          <button
            onClick={() => setShowLogout(true)}
            className="ml-2 relative group cursor-pointer flex items-center gap-3"
          >
            {profileUrl ? (
              <img src={profileUrl} alt="Profile" className="h-8 w-8 rounded-full object-cover ring-2 ring-transparent group-hover:ring-[var(--color-accent)] transition-all duration-200" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[color-mix(in_oklab,var(--color-fg),transparent_90%)] ring-2 ring-transparent group-hover:ring-[var(--color-accent)] transition-all duration-200" />
            )}
            <span className="text-sm font-medium text-[var(--color-fg)] hidden sm:block">
              {displayName}
            </span>
          </button>
        </div>
      </div>
      <div id="page-toolbar-portal" className="w-full" />

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
    </header>
  );
}


