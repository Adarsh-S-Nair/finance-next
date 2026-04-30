"use client";

import { useEffect, useState } from "react";
import { FiEye } from "react-icons/fi";
import { authFetch } from "../lib/api/fetch";
import { supabase } from "../lib/supabase/client";

type Context = {
  impersonating: boolean;
  requester_email?: string | null;
  requester_first_name?: string | null;
  requester_last_name?: string | null;
  target_name?: string | null;
  target_email?: string | null;
  expires_at?: string | null;
  started_at?: string | null;
  session_id?: string;
};

function requesterDisplayName(ctx: Context): string {
  const parts = [ctx.requester_first_name, ctx.requester_last_name].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(" ");
  if (ctx.requester_email) return ctx.requester_email.split("@")[0]!;
  return "an admin";
}

function targetDisplayName(ctx: Context): string {
  if (ctx.target_name && ctx.target_name.trim()) return ctx.target_name;
  if (ctx.target_email) return ctx.target_email;
  return "this user";
}

function formatExpiresIn(iso: string | null | undefined): string {
  if (!iso) return "until revoked";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

/**
 * Persistent red bar shown when the current tab is impersonating another
 * user. Click "Exit" to end the session — clears the impersonator cookie,
 * marks the session ended, signs out of Supabase (kills the minted target
 * session for THIS browser only; the target's other devices keep working),
 * and routes back to the admin app.
 */
export default function ImpersonationBanner() {
  const [ctx, setCtx] = useState<Context>({ impersonating: false });
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await authFetch("/api/impersonation/me");
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setCtx(body as Context);
      } catch {
        // Silent — banner just stays hidden.
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Publish a CSS variable so the sidebar + topbar can shift their
  // top-anchored positions down by exactly the banner's height. Cleared
  // on unmount or when the session ends so non-impersonated views don't
  // pay the offset.
  useEffect(() => {
    const root = document.documentElement;
    if (ctx.impersonating) {
      root.style.setProperty("--impersonation-banner-h", "40px");
    } else {
      root.style.removeProperty("--impersonation-banner-h");
    }
    return () => {
      root.style.removeProperty("--impersonation-banner-h");
    };
  }, [ctx.impersonating]);

  if (!ctx.impersonating) return null;

  async function exit() {
    setExiting(true);
    try {
      await authFetch("/api/impersonation/exit", { method: "POST" });
      try {
        await supabase.auth.signOut();
      } catch {
        // Best-effort — even if signOut fails, the cookie is cleared and
        // the next /me call will return false.
      }
      // Send the admin back to the admin app since that's where they
      // started. window.location to force a hard navigation off this
      // app's localStorage state.
      const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "https://admin.zervo.app";
      window.location.href = adminUrl;
    } finally {
      setExiting(false);
    }
  }

  return (
    <div
      // bg-red-800 — darker + less saturated than red-600. Reads as a
      // serious alert without the screaming-vibrant feel; works against
      // both light and dark page backgrounds. border-black/10 in light
      // mode + border-white/10 in dark gives a subtle hairline at the
      // bottom edge in either theme.
      className="fixed top-0 left-0 right-0 z-[70] h-10 bg-red-800 text-white px-4 flex items-center justify-center gap-3 text-sm border-b border-black/10 dark:border-white/10"
      role="status"
    >
      <FiEye className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">
        Viewing as <strong className="font-medium">{targetDisplayName(ctx)}</strong>
        {" "}— signed in by{" "}
        <strong className="font-medium">{requesterDisplayName(ctx)}</strong>
        {" · "}
        {formatExpiresIn(ctx.expires_at)}
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="ml-2 text-xs font-medium px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 disabled:opacity-50 flex-shrink-0"
      >
        {exiting ? "Exiting…" : "Exit impersonation"}
      </button>
    </div>
  );
}
