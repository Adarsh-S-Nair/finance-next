"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";

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

    (async () => {
      try {
        await supabase.auth.exchangeCodeForSession(code);
      } catch (err) {
        console.error("[auth/callback] Code exchange error:", err);
      }
      // Always redirect — reset-password page handles invalid/expired sessions
      window.location.replace(next);
    })();
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
