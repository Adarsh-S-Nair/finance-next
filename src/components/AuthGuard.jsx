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
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT") {
          router.replace("/");
        } else if (session?.user) {
          setIsAuthenticated(true);
          setIsChecking(false);
        } else if (!session?.user && event === "INITIAL_SESSION") {
          // INITIAL_SESSION with no session means the user is not authenticated
          router.replace("/");
        }
      }
    );

    // Primary check: getSession() reads from localStorage synchronously — no network
    // round-trip needed — so it reliably resolves on hard-refresh before any tokens
    // have been refreshed over the network.
    const checkAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionData?.session?.user) {
          setIsAuthenticated(true);
          setIsChecking(false);
          return;
        }

        // Fallback: validate with the server (handles edge cases like expired sessions)
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (error && error.message && error.message.includes('Refresh Token')) {
          // Stale refresh token — redirect silently without console error
          router.replace("/");
          return;
        }

        if (data?.user) {
          setIsAuthenticated(true);
          setIsChecking(false);
        } else {
          // Not authenticated - redirect to landing page
          router.replace("/");
        }
      } catch (error) {
        if (isMounted) {
          // On error, redirect to landing page for safety
          router.replace("/");
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
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
