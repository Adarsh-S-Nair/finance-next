"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase/client";

/**
 * PublicRoute component that redirects authenticated users away from public pages.
 * Shows a loading spinner while checking auth state, then either renders
 * children (if not authenticated) or shows a spinner while UserProvider handles routing.
 *
 * Note: We do NOT call router.replace here. UserProvider handles post-signin routing
 * (checking if user has accounts → /setup vs /dashboard). Calling router.replace here
 * would race with UserProvider and send new users to /dashboard instead of /setup.
 */
export default function PublicRoute({ children }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (data?.user) {
          // Authenticated — let UserProvider handle routing destination
          setIsAuthenticated(true);
        } else {
          // Not authenticated - show the public page
          setIsChecking(false);
        }
      } catch (error) {
        console.error("[PublicRoute] Error checking auth:", error);
        if (isMounted) {
          // On error, show the public page
          setIsChecking(false);
        }
      }
    };

    checkAuth();

    // Listen for auth state changes — only update isAuthenticated,
    // never call router.replace. UserProvider owns post-signin routing.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_IN" && session?.user) {
          setIsAuthenticated(true);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, []);

  // Show loading state while checking auth
  if (isChecking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  // If authenticated, show spinner while UserProvider figures out where to route
  if (isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  return children;
}
