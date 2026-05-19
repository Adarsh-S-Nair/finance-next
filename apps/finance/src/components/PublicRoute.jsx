"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase/client";
import { resolveNextTarget } from "../lib/cross-app";

/**
 * Wraps public pages (`/auth`, the landing page). If the user is
 * already signed in we redirect them away — to `?next=...` if one was
 * supplied (so cross-app handoffs and bookmarked deep links work), or
 * to `/dashboard` otherwise.
 *
 * Uses only `onAuthStateChange` to avoid deadlocking with Supabase's
 * internal auth lock — `getUser`/`getSession` called inside the
 * listener can hang while the lock is held.
 */
export default function PublicRoute({ children }) {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveTarget = () => {
      const params = new URLSearchParams(window.location.search);
      return resolveNextTarget(params.get("next"));
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        console.log("[PublicRoute] onAuthStateChange:", event, "user:", !!session?.user);

        if (session?.user) {
          setIsAuthenticated(true);
          setIsChecking(false);
          router.replace(resolveTarget());
        } else if (event === "INITIAL_SESSION" && !session?.user) {
          setIsChecking(false);
        }
      }
    );

    const timeout = setTimeout(() => {
      if (isMounted) {
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

  if (isChecking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  return children;
}
