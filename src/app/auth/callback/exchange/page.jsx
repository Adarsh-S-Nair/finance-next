"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";

function ExchangeHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") || "/auth/reset-password";

    if (!code) {
      router.replace("/auth");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.error("[auth/callback] Code exchange failed:", error.message);
      }
      router.replace(next);
    });
  }, [searchParams, router]);

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
