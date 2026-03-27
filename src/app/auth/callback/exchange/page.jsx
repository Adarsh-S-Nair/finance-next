"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

function ExchangeHandler() {
  const searchParams = useSearchParams();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = searchParams.get("code");
    const next = searchParams.get("next") || "/auth/reset-password";

    if (!code) {
      window.location.replace("/auth");
      return;
    }

    // Safety timeout — if exchange takes too long, redirect anyway
    const timeout = setTimeout(() => {
      console.warn("[auth/callback] Exchange timed out, redirecting anyway");
      window.location.replace(next);
    }, 8000);

    // Dynamic import to avoid any module-level errors blocking the page
    import("../../../../lib/supabase/client")
      .then(({ supabase }) => supabase.auth.exchangeCodeForSession(code))
      .then(({ error }) => {
        if (error) console.error("[auth/callback] Exchange error:", error.message);
      })
      .catch((err) => {
        console.error("[auth/callback] Exchange failed:", err);
      })
      .finally(() => {
        clearTimeout(timeout);
        window.location.replace(next);
      });
  }, [searchParams]);

  return null;
}

export default function ExchangeCodePage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      <Suspense>
        <ExchangeHandler />
      </Suspense>
    </div>
  );
}
