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

    console.log("[exchange] Starting. code:", !!code, "next:", next);

    if (!code) {
      console.log("[exchange] No code found, redirecting to /auth");
      window.location.replace("/auth");
      return;
    }

    // Safety timeout — if exchange takes too long, redirect anyway
    const timeout = setTimeout(() => {
      console.warn("[exchange] Exchange timed out after 8s, redirecting to", next);
      window.location.replace(next);
    }, 8000);

    const t0 = Date.now();
    // Dynamic import to avoid any module-level errors blocking the page
    import("../../../../lib/supabase/client")
      .then(({ supabase }) => {
        console.log("[exchange] Calling exchangeCodeForSession...");
        return supabase.auth.exchangeCodeForSession(code);
      })
      .then(({ data, error }) => {
        console.log("[exchange] Exchange completed in", Date.now() - t0, "ms");
        if (error) console.error("[exchange] Exchange error:", error.message);
        else console.log("[exchange] Exchange success. user:", !!data?.user, "session:", !!data?.session);
      })
      .catch((err) => {
        console.error("[exchange] Exchange failed:", err);
      })
      .finally(() => {
        clearTimeout(timeout);
        console.log("[exchange] Redirecting to", next);
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
