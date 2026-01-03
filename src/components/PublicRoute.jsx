"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

/**
 * PublicRoute component that redirects authenticated users away from public pages.
 * Shows a loading spinner while checking auth state, then either renders
 * children (if not authenticated) or redirects to dashboard (if authenticated).
 */
export default function PublicRoute({ children }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!isMounted) return;

        if (data?.user) {
          // Authenticated - redirect to dashboard
          router.replace("/dashboard");
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

    // Listen for auth state changes
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        if (event === "SIGNED_IN" && session?.user) {
          // User just signed in - redirect to dashboard
          router.replace("/dashboard");
          setIsAuthenticated(true);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.subscription?.unsubscribe?.();
    };
  }, [router]);

  // Show loading state while checking auth
  if (isChecking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  // If authenticated, don't render children (redirect is happening)
  if (isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  return children;
}
