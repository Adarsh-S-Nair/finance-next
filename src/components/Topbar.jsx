"use client";

import ThemeToggle from "./ThemeToggle";
import AccentPicker from "./AccentPicker";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Topbar() {
  const pathname = usePathname();
  const isAuth = pathname.startsWith("/auth");
  const isDashboard = pathname.startsWith("/dashboard");
  const isAuthedRoute = isDashboard || pathname.startsWith("/accounts") || pathname.startsWith("/transactions") || pathname.startsWith("/budgets") || pathname.startsWith("/investments") || pathname.startsWith("/settings");
  const isLanding = pathname === "/";
  const [user, setUser] = useState(null);

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

  if (isAuthedRoute) return null;
  if (isLanding && user) return null;

  return (
    <header className="sticky top-0 z-20 w-full bg-[var(--color-bg)]/70 backdrop-blur">
      <div className="container mx-auto flex items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-fg)] text-[var(--color-on-primary)]">ƒ</span>
          <span className="font-semibold">Zentari</span>
        </Link>
        <nav className="flex items-center gap-3">
          <AccentPicker />
          <ThemeToggle />
          {!isAuth && !user && (
            <Link className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]" href="/auth">Log in / Sign up</Link>
          )}
          {user && (
            <>
              <span className="text-sm text-[var(--color-muted)] hidden sm:inline">{user.email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="inline-flex rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-fg)] hover:bg-[color-mix(in_oklab,var(--color-fg),transparent_94%)]"
              >
                Sign out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}


