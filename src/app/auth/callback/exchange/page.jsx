"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BRAND } from "../../../../config/brand";

function ExchangeHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = searchParams.get("code");
    const nextOverride = searchParams.get("next"); // explicit override, if any

    console.log("[exchange] Starting. code:", !!code, "nextOverride:", nextOverride);

    if (!code) {
      console.log("[exchange] No code found, redirecting to /auth");
      router.replace("/auth");
      return;
    }

    // Safety timeout — if exchange takes too long, fall through
    const timeout = setTimeout(() => {
      console.warn("[exchange] Exchange timed out after 8s, redirecting");
      router.replace(nextOverride || "/dashboard");
    }, 8000);

    const t0 = Date.now();
    let target = nextOverride || "/dashboard";

    // Dynamic import to avoid any module-level errors blocking the page
    import("../../../../lib/supabase/client")
      .then(({ supabase }) => {
        console.log("[exchange] Calling exchangeCodeForSession...");
        return supabase.auth
          .exchangeCodeForSession(code)
          .then((result) => ({ supabase, result }));
      })
      .then(async ({ supabase, result }) => {
        const { data, error } = result;
        console.log("[exchange] Exchange completed in", Date.now() - t0, "ms");
        if (error) {
          console.error("[exchange] Exchange error:", error.message);
          return;
        }
        console.log("[exchange] Exchange success. user:", !!data?.user);

        const user = data?.user;
        if (!user) return;

        // Sync Google profile photo + name into user_profiles
        try {
          const meta = user.user_metadata || {};
          const googleAvatar = meta.avatar_url || meta.picture || null;
          const firstName = meta.full_name?.split(" ")[0] || meta.name?.split(" ")[0] || null;
          const lastName = meta.full_name?.split(" ").slice(1).join(" ") || null;

          if (googleAvatar || firstName) {
            const { upsertUserProfile } = await import("../../../../lib/user/profile");
            const updates = {};
            if (googleAvatar) updates.avatar_url = googleAvatar;
            if (firstName) updates.first_name = firstName;
            if (lastName) updates.last_name = lastName;
            await upsertUserProfile(updates);
            console.log("[exchange] Synced Google profile:", Object.keys(updates));
          }
        } catch (err) {
          console.error("[exchange] Failed to sync Google profile:", err);
        }

        // Route directly to the right place based on whether the user has
        // accounts. Without this, returning users bounce through /setup on
        // the way to /dashboard — the SetupShell flash looks like a reload
        // to the landing page because both use the same dark/logo chrome.
        if (!nextOverride) {
          try {
            const { data: items } = await supabase
              .from("plaid_items")
              .select("id")
              .eq("user_id", user.id)
              .limit(1);
            target = items && items.length > 0 ? "/dashboard" : "/setup";
            console.log("[exchange] Routing based on accounts:", target);
          } catch (err) {
            console.warn("[exchange] Accounts check failed, defaulting to /setup:", err);
            target = "/setup";
          }
        }
      })
      .catch((err) => {
        console.error("[exchange] Exchange failed:", err);
      })
      .finally(() => {
        clearTimeout(timeout);
        console.log("[exchange] Redirecting to", target);
        // Client-side nav (not window.location.replace) so the React root
        // stays mounted across the transition and we don't flash through
        // the landing page or a blank browser state.
        router.replace(target);
      });
  }, [router, searchParams]);

  return null;
}

export default function ExchangeCodePage() {
  return (
    <>
      {/* Force dark bg on html/body to prevent a flash of white before the
          React tree hydrates. Mirrors the technique used on /auth. */}
      <style>{`html, body { background: #09090b !important; }`}</style>
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-zinc-950 text-white">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="block h-10 w-10 bg-white"
            style={{
              WebkitMaskImage: "url(/logo.svg)",
              maskImage: "url(/logo.svg)",
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
              maskPosition: "center",
            }}
          />
          <span
            className="text-sm font-medium tracking-[0.18em] text-white"
            style={{ fontFamily: "var(--font-outfit)" }}
          >
            {BRAND.name.toUpperCase()}
          </span>
        </div>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/15 border-t-white" />
        <p className="text-sm text-zinc-500">Signing you in…</p>
        <Suspense>
          <ExchangeHandler />
        </Suspense>
      </div>
    </>
  );
}
