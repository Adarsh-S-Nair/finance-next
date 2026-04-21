"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabase/client";

/**
 * AuthGuard component that protects routes requiring authentication.
 * Shows a loading spinner while checking auth state, then either renders
 * children (if authenticated) or redirects to landing page (if not).
 */
export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Set up the auth state listener FIRST so we never miss INITIAL_SESSION events.
    // On a hard-refresh Supabase emits INITIAL_SESSION once it restores from localStorage;
    // if the listener isn't wired up yet that event is lost and isChecking stays true forever.
    console.log("[AuthGuard] Setting up auth check, pathname:", pathname);
    const t0 = Date.now();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        console.log("[AuthGuard] onAuthStateChange:", event, "user:", !!session?.user, "elapsed:", Date.now() - t0, "ms");

        if (event === "SIGNED_OUT") {
          router.replace("/");
        } else if (session?.user) {
          console.log("[AuthGuard] Authenticated via", event);
          setIsAuthenticated(true);
          setIsChecking(false);
        } else if (!session?.user && event === "INITIAL_SESSION") {
          console.log("[AuthGuard] No session on INITIAL_SESSION, redirecting");
          router.replace("/");
        }
      }
    );

    // Don't call getSession()/getUser() eagerly — they can deadlock if
    // onAuthStateChange is already holding the Supabase auth lock.
    // Rely solely on the onAuthStateChange listener above for auth state.
    // Add a safety timeout so AuthGuard never spins forever.
    const authGuardTimeout = setTimeout(() => {
      if (!isMounted) return;
      console.log("[AuthGuard] Safety timeout — checking localStorage for session");
      // Last resort: check localStorage directly
      let hasSession = false;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          hasSession = true;
          break;
        }
      }
      if (hasSession) {
        console.log("[AuthGuard] Found session in localStorage, allowing through");
        setIsAuthenticated(true);
        setIsChecking(false);
      } else {
        console.log("[AuthGuard] No session found, redirecting to /");
        router.replace("/");
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(authGuardTimeout);
      subscription.subscription?.unsubscribe?.();
    };
  }, [router, pathname]);

  // Show loading state while checking auth
  if (isChecking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-muted)] border-t-[var(--color-accent)]" />
      </div>
    );
  }

  // Only render children if authenticated
  if (!isAuthenticated) {
    return null;
  }

  return children;
}
