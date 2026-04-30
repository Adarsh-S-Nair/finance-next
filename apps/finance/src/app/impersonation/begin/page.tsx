"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "../../../lib/api/fetch";

function BeginHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attempted = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const sessionId = searchParams.get("session");
    if (!sessionId) {
      router.replace("/dashboard");
      return;
    }

    authFetch(`/api/impersonation/begin?session=${encodeURIComponent(sessionId)}`, {
      method: "POST",
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || `Begin failed (${res.status})`);
        }
        router.replace("/dashboard");
      })
      .catch((e) => {
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
