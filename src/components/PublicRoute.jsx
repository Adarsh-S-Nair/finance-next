"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";

/**
 * PublicRoute component that redirects authenticated users away from public pages.
 * Uses only onAuthStateChange to avoid deadlocking with Supabase's internal auth lock.
 */
export default function PublicRoute({ children }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Rely solely on onAuthStateChange — never call getUser()/getSession()
    // directly, as they can deadlock with the auth lock held by the listener.
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        console.log("[PublicRoute] onAuthStateChange:", event, "user:", !!session?.user);

        if (session?.user) {
          setIsAuthenticated(true);
          setIsChecking(false);
          // Redirect authenticated users to dashboard immediately
          router.replace("/dashboard");
        } else if (event === "INITIAL_SESSION" && !session?.user) {
          // No session — show the public page
          setIsChecking(false);
        }
      }
    );

    // Safety timeout — if onAuthStateChange never fires, show public page
    const timeout = setTimeout(() => {
      if (isMounted && isChecking) {
        console.log("[PublicRoute] Safety timeout — showing public page");
        setIsChecking(false);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
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

  // If authenticated, show spinner while redirecting
  if (isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  return children;
}
