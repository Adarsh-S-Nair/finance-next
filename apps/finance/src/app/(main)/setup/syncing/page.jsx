"use client";

/**
 * /setup/syncing — post-FTUX sync splash.
 *
 * Users land here immediately after connecting their first Plaid account.
 * The dashboard can't render anything meaningful yet because the initial
 * Plaid backfill (accounts, transactions, balances) runs as a background
 * task behind webhooks. Instead of dumping them onto an empty dashboard
 * that requires a manual refresh, this page:
 *
 *   1. Polls /api/plaid/sync-status every 2s for a clean "all items
 *      ready" signal.
 *   2. Also subscribes to Realtime UPDATEs on plaid_items — if a webhook
 *      flips sync_status or writes last_transaction_sync, we catch it
 *      immediately without waiting for the next poll tick.
 *   3. Shows phased copy ("Fetching accounts…" → "Pulling transactions…"
 *      → "Almost ready…") so the wait feels intentional instead of
 *      broken.
 *   4. Falls through to /dashboard after MAX_WAIT_MS regardless — a
 *      flaky webhook shouldn't strand the user here forever. The
 *      dashboard will render whatever's arrived by that point and
 *      Realtime subscriptions there will fill in the rest.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheck } from "react-icons/fi";
import { useUser } from "../../../../components/providers/UserProvider";
import { useAccounts } from "../../../../components/providers/AccountsProvider";
import { authFetch } from "../../../../lib/api/fetch";
import { supabase } from "../../../../lib/supabase/client";

const POLL_INTERVAL_MS = 2000;
// Fallback: 90s. Typical Plaid initial sync finishes inside 30–60s;
// this gives generous headroom without trapping users on a splash.
const MAX_WAIT_MS = 90_000;

const PHASES = [
  { threshold: 0, label: "Fetching accounts…" },
  { threshold: 15_000, label: "Pulling transactions…" },
  { threshold: 35_000, label: "Categorizing spending…" },
  { threshold: 60_000, label: "Almost ready…" },
];

function phaseLabel(elapsedMs) {
  let current = PHASES[0].label;
  for (const p of PHASES) {
    if (elapsedMs >= p.threshold) current = p.label;
  }
  return current;
}

export default function SyncingPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { refreshAccounts } = useAccounts();
  const [status, setStatus] = useState(null); // null | server response
  const [elapsedMs, setElapsedMs] = useState(0);
  const [done, setDone] = useState(false);
  const mountedRef = useRef(true);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Elapsed-time ticker for phased copy and the fallback timeout.
  useEffect(() => {
    const id = setInterval(() => {
      if (!mountedRef.current) return;
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 500);
    return () => clearInterval(id);
  }, []);

  const finish = useCallback(async () => {
    if (done || !mountedRef.current) return;
    setDone(true);
    // Pull fresh accounts into the provider so the dashboard renders with
    // data already in memory instead of triggering another fetch spinner.
    try {
      await refreshAccounts();
    } catch {
      // non-fatal — dashboard will refetch on its own
    }
    if (mountedRef.current) router.replace("/dashboard");
  }, [done, refreshAccounts, router]);

  // Poll the status endpoint.
  useEffect(() => {
    if (authLoading || !user?.id) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await authFetch("/api/plaid/sync-status");
        if (!res.ok || cancelled || !mountedRef.current) return;
        const data = await res.json();
        setStatus(data);
        if (data.ready) {
          await finish();
        }
      } catch (err) {
        if (!cancelled) console.warn("[syncing] status poll failed:", err);
      }
    };

    // Immediate tick, then interval.
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [authLoading, user?.id, finish]);

  // Realtime subscription on plaid_items — any UPDATE (status flip, sync
  // timestamp write) triggers an immediate status re-fetch so we don't
  // have to wait for the next poll tick.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`sync-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "plaid_items",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          if (!mountedRef.current) return;
          try {
            const res = await authFetch("/api/plaid/sync-status");
            if (!res.ok || !mountedRef.current) return;
            const data = await res.json();
            setStatus(data);
            if (data.ready) await finish();
          } catch {
            // fall back to next poll tick
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, finish]);

  // Fallback: after MAX_WAIT_MS, ship the user to the dashboard anyway.
  useEffect(() => {
    if (elapsedMs < MAX_WAIT_MS) return;
    finish();
  }, [elapsedMs, finish]);

  const itemsTotal = status?.itemsTotal ?? 0;
  const itemsReady = status?.itemsReady ?? 0;
  // Progress = items ready / total, floored to 10% so the bar doesn't
  // look stuck at 0 for the first couple seconds before the first
  // webhook fires.
  const progressPct =
    itemsTotal > 0
      ? Math.max(10, Math.round((itemsReady / itemsTotal) * 100))
      : Math.min(90, Math.round((elapsedMs / MAX_WAIT_MS) * 100));

  const label = phaseLabel(elapsedMs);
  const isTakingLong = elapsedMs > 60_000;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        {/* Breathing circle */}
        <div className="relative mx-auto mb-8 h-16 w-16">
          <div className="absolute inset-0 rounded-full border-2 border-[var(--color-border)]" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[var(--color-fg)] animate-spin"
            style={{ animationDuration: "1.2s" }}
          />
          <div className="absolute inset-3 flex items-center justify-center rounded-full bg-[var(--color-surface-alt)]">
            <FiCheck
              className="h-5 w-5 text-[var(--color-fg)] opacity-40"
              aria-hidden
            />
          </div>
        </div>

        <h1 className="text-lg font-medium text-[var(--color-fg)]">
          Setting up your accounts
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {label}
        </p>

        {/* Progress bar */}
        <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]">
          <div
            className="h-full rounded-full bg-[var(--color-fg)] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="mt-4 text-[11px] tabular-nums text-[var(--color-muted)]">
          {itemsTotal > 0
            ? `${itemsReady} of ${itemsTotal} ${itemsTotal === 1 ? "account" : "accounts"} ready`
            : "Connecting to your bank…"}
        </p>

        {isTakingLong && (
          <p className="mt-6 text-xs text-[var(--color-muted)]">
            This is taking longer than usual. Your data will keep syncing in
            the background — you can head to your dashboard anytime.
          </p>
        )}

        {isTakingLong && (
          <button
            type="button"
            onClick={finish}
            className="mt-3 text-xs font-medium text-[var(--color-fg)] underline-offset-2 hover:underline"
          >
            Go to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
