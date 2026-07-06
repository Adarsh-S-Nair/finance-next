"use client";

import { useState, useEffect, useCallback, useId } from "react";
import { useUser } from "../../components/providers/UserProvider";
import { useAccounts } from "../../components/providers/AccountsProvider";
import { authFetch } from "../api/fetch";
import { supabase } from "../supabase/client";

export interface PlaidConnectionError {
  /** plaid_items.id of the errored connection. */
  id: string;
  /** Raw Plaid error_message (e.g. the ITEM_LOGIN_REQUIRED text). */
  lastError: string | null;
  /** Friendly institution name resolved from the loaded accounts. */
  bank: string;
}

/**
 * Watches the user's Plaid connections for error states (typically
 * ITEM_LOGIN_REQUIRED — the bank invalidated the link after a password / MFA
 * / session change) and returns them enriched with the institution name.
 *
 * Shared by the accounts-page ReconnectBanner and the dashboard
 * AssistantPanel so both surface the same "reconnect" prompt without
 * duplicating the sync-status fetch + Realtime plumbing. Refetches on any
 * plaid_items change, so the prompt clears the instant a reconnect succeeds
 * and the webhook flips sync_status back to 'idle'.
 */
export function usePlaidConnectionErrors(): {
  errors: PlaidConnectionError[];
  refetch: () => void;
} {
  const { user } = useUser();
  const { allAccounts } = useAccounts();
  // Unique per hook instance. The dashboard mounts AssistantPanel twice
  // (mobile + desktop, both in the DOM), so a per-user channel name would
  // collide — the second supabase.channel(name) returns the already
  // subscribed instance and .on() after subscribe() throws. useId keeps
  // each instance's channel distinct.
  const instanceId = useId();
  const [rows, setRows] = useState<{ id: string; lastError: string | null }[]>(
    [],
  );

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      return;
    }
    try {
      const res = await authFetch("/api/plaid/sync-status");
      if (!res.ok) return;
      const data = await res.json();
      const errored = ((data.items ?? []) as {
        id: string;
        sync_status: string | null;
        last_error: string | null;
      }[])
        .filter((it) => it.sync_status === "error")
        .map((it) => ({ id: it.id, lastError: it.last_error }));
      setRows(errored);
    } catch (err) {
      console.warn("[usePlaidConnectionErrors] sync-status fetch failed:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Refetch on any plaid_items change — a reconnect flips status back to
  // 'idle' (prompt vanishes), a fresh failure flips it to 'error' (prompt
  // appears) — without a polling loop.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`plaid-connection-errors-${user.id}-${instanceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plaid_items",
          filter: `user_id=eq.${user.id}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetch, instanceId]);

  const errors: PlaidConnectionError[] = rows.map((r) => {
    const match = (allAccounts ?? []).find(
      (a: { plaidItemId?: string | null; bank?: string | null }) =>
        a.plaidItemId === r.id,
    );
    return { id: r.id, lastError: r.lastError, bank: match?.bank || "your bank" };
  });

  return { errors, refetch };
}
