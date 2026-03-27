"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase/client";

export default function ExchangeCodePage() {
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
      // Redirect regardless — the reset-password page handles expired/invalid sessions
      router.replace(next);
    });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
    </div>
  );
}
