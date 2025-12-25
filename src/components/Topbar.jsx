"use client";

import ThemeToggle from "./ThemeToggle";
import AccentPicker from "./AccentPicker";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import ConfirmDialog from "./ui/ConfirmDialog";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "./UserProvider";

export default function Topbar() {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/auth");
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthedRoute = isDashboard || pathname.startsWith("/accounts") || pathname.startsWith("/transactions") || pathname.startsWith("/budgets") || pathname.startsWith("/investments") || pathname.startsWith("/settings") || pathname.startsWith("/docs");
  const isLanding = pathname === "/";
  const { logout } = useUser();
  const [user, setUser] = useState(null);
  const [showLogout, setShowLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  if (isAuthedRoute || isAuth) return null;
  if (isLanding && user) return null;

  return (
    <header className="sticky top-0 z-20 w-full bg-white/70 backdrop-blur border-b border-zinc-100">
      <div className="container mx-auto flex items-center justify-between px-6 py-2 h-20">
        <Link href="/" className="flex items-center flex-shrink-0">
          <span
            aria-hidden
            className="block h-16 w-16 bg-zinc-900 flex-shrink-0"
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
        </Link>
        <nav className="flex items-center gap-3">
          {/* Theme / Accent controls removed on landing/auth pages */}
          {!isAuth && !user && (
            <Link className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]" href="/auth">Log in / Sign up</Link>
          )}
          {user && (
            <>
              <span className="text-sm text-[var(--color-muted)] hidden sm:inline">{user.email}</span>
              <button
                onClick={() => setShowLogout(true)}
                className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]"
              >
                Sign out
              </button>
              <ConfirmDialog
                isOpen={showLogout}
                onCancel={() => setShowLogout(false)}
                onConfirm={async () => {
                  try {
                    setLoggingOut(true);
                    logout(); // Reset theme and accent immediately
                    await supabase.auth.signOut();
                  } finally {
                    setLoggingOut(false);
                    setShowLogout(false);
                  }
                }}
                title="Sign out"
                description="Are you sure you want to sign out?"
                confirmLabel="Sign out"
                busyLabel="Signing out..."
                cancelLabel="Cancel"
                variant="primary"
                busy={loggingOut}
              />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}