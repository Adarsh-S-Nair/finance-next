"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

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

    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (data?.user) {
          setIsAuthenticated(true);
          setIsChecking(false);
        } else {
          // Not authenticated - redirect to landing page
          router.replace("/");
        }
      } catch (error) {
        console.error("[AuthGuard] Error checking auth:", error);
        if (isMounted) {
          // On error, redirect to landing page for safety
          router.replace("/");
        }
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_OUT" || !session?.user) {
          // User signed out or session expired - redirect to landing
          router.replace("/");
        } else if (session?.user) {
          setIsAuthenticated(true);
          setIsChecking(false);
        }
      }
    );

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
