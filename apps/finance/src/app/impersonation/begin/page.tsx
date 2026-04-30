"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase/client";

function BeginHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attempted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const sessionId = searchParams.get("session");
    const tokenHash = searchParams.get("token_hash");
    if (!sessionId || !tokenHash) {
      router.replace("/dashboard");
      return;
    }

    (async () => {
      // 1) Sign in as the target user using the admin-issued token.
      //    verifyOtp is the non-PKCE branch — it doesn't need a
      //    client-stored verifier, which is exactly why we use it
      //    here (admin.generateLink doesn't generate one).
      const { data: otpData, error: otpErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (otpErr || !otpData?.session?.access_token) {
        throw new Error(otpErr?.message || "Could not verify magic token");
      }
      const accessToken = otpData.session.access_token;

      // 2) Mark the impersonation_sessions row consumed and have the
      //    server set the httpOnly impersonator cookie on this response.
      //    Pass the bearer explicitly so we don't race against the
      //    auth-token cache picking up the new session.
      const res = await fetch(
        `/api/impersonation/begin?session=${encodeURIComponent(sessionId)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Begin failed (${res.status})`);
      }

      // Hard navigation, not router.replace — we want a fresh page
      // load so the AppShell + UserProvider remount with the target
      // user's session in localStorage.
      window.location.replace("/dashboard");
    })().catch((e) => {
      setError(e?.message || "Could not start session");
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 text-zinc-900">
      <div className="text-center">
        {error ? (
          <>
            <div className="text-sm font-medium">Could not enter session</div>
            <div className="text-xs text-zinc-500 mt-1">{error}</div>
          </>
        ) : (
          <div className="text-sm text-zinc-500">Entering session…</div>
        )}
      </div>
    </div>
  );
}

export default function BeginPage() {
  return (
    <Suspense>
      <BeginHandler />
    </Suspense>
  );
}
