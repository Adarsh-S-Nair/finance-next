"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ZERVO_APP_URL =
  process.env.NEXT_PUBLIC_ZERVO_APP_URL ?? "https://www.zervo.app";

/**
 * Receives a Supabase session handed off from the main zervo app and
 * installs it locally so the developer portal's cookie-based session is
 * authenticated without running a Google OAuth flow here.
 *
 * See apps/admin/src/app/auth/sso/page.tsx for the full mechanism — the
 * two are intentionally identical; both apps just receive and install.
 */
export default function DeveloperSsoPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const next = params.get("next") ?? "/";

    if (!access_token || !refresh_token) {
      const returnUrl = encodeURIComponent(`${window.location.origin}${next}`);
      window.location.replace(`${ZERVO_APP_URL}/auth?next=${returnUrl}`);
      return;
    }

    const supabase = createClient();
    void supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error: e }) => {
        if (e) {
          setError(e.message);
          return;
        }
        window.history.replaceState(null, "", next);
        router.replace(next);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-content-bg)]">
      {error ? (
        <p className="text-sm text-[var(--color-danger)]">{error}</p>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">Signing you in…</p>
      )}
    </div>
  );
}
